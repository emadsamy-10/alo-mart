"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/lib/i18n/navigation";
import type { AccountError, AccountResult } from "@/lib/api/account-client";
import type { Locale } from "@/lib/i18n/routing";
import { deviceName } from "./device";
import { firstErrors, secret, text, type FormState } from "./form-state";
import { afterRegister, loginHref, safeNext } from "./redirect";
import {
  addressSchema,
  anySchema,
  authResultSchema,
  customerSchema,
  emailChangeResultSchema,
  revokedSchema,
  verifyResultSchema,
} from "./schemas";
import { accountCall, clearSessionToken, readSessionToken, writeSessionToken } from "./session";

/*
 * Server Actions for every customer-account mutation. They run on the
 * storefront server: the browser posts the form, the action calls the API
 * with the token from the httpOnly cookie. Next.js rejects a Server Action
 * whose Origin does not match the host (CSRF), and every action re-validates
 * its input — client checks are only a convenience.
 */

/** Re-render the account pages and header (name, verification state, sessions) after a change. */
function refreshAccount() {
  revalidatePath("/[locale]", "layout");
}

/** A generic, translated message for failures without a useful API message. */
async function failure(error: AccountError, values?: Record<string, string>, rename?: Record<string, string>): Promise<FormState> {
  const t = await getTranslations("Account.errors");
  const fieldErrors = firstErrors(error.errors, rename);
  const message =
    error.kind === "rate_limited" ? t("rateLimited")
    : error.kind === "network" || error.kind === "timeout" ? t("network")
    : error.kind === "server" || error.kind === "invalid_response" ? t("server")
    : fieldErrors ? t("checkFields")
    : (error.message ?? t("server"));
  return { status: "error", message, code: error.code, fieldErrors, values };
}

/** The session ended on the API side (expired, revoked, deactivated): sign out here too. */
async function requireSession<T>(result: AccountResult<T>, back: string): Promise<AccountResult<T>> {
  if (!result.ok && result.error.kind === "unauthorized") {
    await clearSessionToken();
    const locale = (await getLocale()) as Locale;
    redirect({ href: loginHref(back), locale });
  }
  return result;
}

/* ------------------------------ sign-in ------------------------------ */

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const email = text(form, "email", 255);
  const values = { email };
  const t = await getTranslations("Auth");
  if (!email || !secret(form, "password")) {
    return { status: "error", message: t("login.missing"), values, fieldErrors: { ...(!email ? { email: t("required") } : {}), ...(!secret(form, "password") ? { password: t("required") } : {}) } };
  }

  const result = await accountCall("POST", "/user/auth/login", authResultSchema, {
    locale,
    body: {
      email,
      password: secret(form, "password"),
      remember: form.get("remember") === "on",
      device_name: deviceName((await headers()).get("user-agent")),
    },
  });
  if (!result.ok) {
    // Never say which of email/password was wrong.
    if (result.error.kind === "unauthorized") return { status: "error", message: t("login.invalid"), values };
    if (result.error.kind === "forbidden") return { status: "error", message: t("login.inactive"), values };
    return failure(result.error, values);
  }

  await writeSessionToken(result.data.token, result.data.expires_at);
  return redirect({ href: safeNext(form.get("next")), locale });
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const values = { name: text(form, "name", 255), email: text(form, "email", 255), phone: text(form, "phone", 30) };
  const t = await getTranslations("Auth");
  const password = secret(form, "password");
  if (password !== secret(form, "password_confirmation")) {
    return { status: "error", message: (await getTranslations("Account.errors"))("checkFields"), values, fieldErrors: { password_confirmation: t("passwordMismatch") } };
  }

  // Only these fields are sent: no role, status or any other account attribute.
  const result = await accountCall("POST", "/user/auth/register", authResultSchema, {
    locale,
    body: {
      ...values,
      password,
      password_confirmation: password,
      device_name: deviceName((await headers()).get("user-agent")),
    },
  });
  if (!result.ok) return failure(result.error, values);

  await writeSessionToken(result.data.token, result.data.expires_at);
  return redirect({ href: afterRegister(safeNext(form.get("next"), ""), result.data.verification_email_sent), locale });
}

export async function logoutAction(): Promise<void> {
  const locale = await getLocale();
  if (await readSessionToken()) {
    // Revoke the token on the API; sign out locally even if the API is unreachable.
    await accountCall("POST", "/user/auth/logout", anySchema, { locale });
  }
  await clearSessionToken();
  return redirect({ href: "/?signed_out=1", locale });
}

/* ------------------------- password recovery ------------------------- */

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const email = text(form, "email", 255);
  const t = await getTranslations("Auth");
  if (!email) return { status: "error", fieldErrors: { email: t("required") }, message: t("forgot.missing") };

  const result = await accountCall("POST", "/user/auth/password/forgot", anySchema, { locale, body: { email } });
  if (!result.ok) return failure(result.error, { email });
  // Same answer whether or not the address has an account.
  return { status: "success", message: t("forgot.sent"), values: { email } };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Auth");
  const email = text(form, "email", 255);
  const password = secret(form, "password");
  if (password !== secret(form, "password_confirmation")) {
    return { status: "error", message: t("passwordMismatch"), fieldErrors: { password_confirmation: t("passwordMismatch") } };
  }
  const result = await accountCall("POST", "/user/auth/password/reset", anySchema, {
    locale,
    body: { token: text(form, "token", 200), email, password, password_confirmation: password },
  });
  if (!result.ok) {
    if (result.error.code === "reset_invalid") return { status: "error", code: "reset_invalid", message: t("reset.invalid") };
    return failure(result.error);
  }
  // Every session was revoked by the API, including any on this device.
  await clearSessionToken();
  return redirect({ href: "/login?reset=1", locale });
}

/* --------------------------- verification ---------------------------- */

export async function verifyEmailAction(token: string): Promise<{ status: "verified" | "already" | "expired" | "invalid" | "error"; signedIn: boolean }> {
  const locale = await getLocale();
  const signedIn = !!(await readSessionToken());
  if (!/^[A-Za-z0-9]{64}$/.test(token)) return { status: "invalid", signedIn };
  const result = await accountCall("POST", "/user/auth/email/verify", verifyResultSchema, { locale, body: { token } });
  if (result.ok) return { status: result.data.already_verified ? "already" : "verified", signedIn };
  if (result.error.code === "verification_expired") return { status: "expired", signedIn };
  if (result.error.code === "verification_invalid" || result.error.kind === "validation") return { status: "invalid", signedIn };
  return { status: "error", signedIn };
}

export async function resendVerificationAction(): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Auth");
  const result = await requireSession(await accountCall("POST", "/user/auth/email/resend", verifyResultSchema.pick({ already_verified: true }), { locale }), "/account/security");
  if (!result.ok) {
    if (result.error.code === "resend_too_soon") return { status: "error", code: "resend_too_soon", message: t("verify.tooSoon") };
    // The mail transport is down: say that, not a generic "something went wrong".
    if (result.error.code === "mail_delivery_failed") return { status: "error", code: "mail_delivery_failed", message: t("verify.notSent") };
    return failure(result.error);
  }
  // Verified meanwhile (e.g. in another tab): nothing was sent.
  return { status: "success", message: result.data.already_verified ? t("verify.already.body") : t("verify.resent") };
}

/* ------------------------------ profile ------------------------------ */

export async function updateProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Account");
  const gender = text(form, "gender", 10);
  const dob = text(form, "date_of_birth", 10);
  const values = { name: text(form, "name", 255), gender, date_of_birth: dob };
  const result = await requireSession(
    await accountCall("PUT", "/user/profile", customerSchema, {
      locale,
      body: { name: values.name, gender: gender === "male" || gender === "female" ? gender : null, date_of_birth: dob || null },
    }),
    "/account/profile",
  );
  if (!result.ok) return failure(result.error, values);
  refreshAccount();
  return { status: "success", message: t("profile.saved"), values };
}

/* ------------------------------ security ----------------------------- */

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Account");
  const password = secret(form, "password");
  if (password !== secret(form, "password_confirmation")) {
    return { status: "error", message: (await getTranslations("Auth"))("passwordMismatch"), fieldErrors: { password_confirmation: (await getTranslations("Auth"))("passwordMismatch") } };
  }
  const result = await requireSession(
    await accountCall("PUT", "/user/auth/password", anySchema, {
      locale,
      body: { current_password: secret(form, "current_password"), password, password_confirmation: password },
    }),
    "/account/security",
  );
  if (!result.ok) return failure(result.error);
  refreshAccount();
  return { status: "success", message: t("security.passwordChanged") };
}

export async function changeEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Account");
  const email = text(form, "email", 255);
  const result = await requireSession(
    await accountCall("PUT", "/user/auth/email", emailChangeResultSchema, { locale, body: { email, current_password: secret(form, "current_password") } }),
    "/account/security",
  );
  if (!result.ok) return failure(result.error, { email });
  refreshAccount();
  // Truthful about the confirmation link: the backend says whether it could send it.
  const key = result.data.verification_email_sent ? "security.emailChanged" : "security.emailChangedUnsent";
  return { status: "success", message: t(key, { email: result.data.account.email }) };
}

export async function changePhoneAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Account");
  const phone = text(form, "phone", 30);
  const result = await requireSession(
    await accountCall("PUT", "/user/auth/phone", customerSchema, { locale, body: { phone, current_password: secret(form, "current_password") } }),
    "/account/security",
  );
  if (!result.ok) return failure(result.error, { phone });
  refreshAccount();
  return { status: "success", message: t("security.phoneChanged") };
}

export async function revokeSessionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Account");
  const id = Number(text(form, "session_id", 20));
  if (!Number.isInteger(id) || id <= 0) return { status: "error", message: t("security.sessionNotFound") };
  const result = await requireSession(await accountCall("DELETE", `/user/auth/sessions/${id}`, anySchema, { locale }), "/account/security");
  if (!result.ok) return failure(result.error);
  return redirect({ href: "/account/security?sessions=revoked#sessions", locale });
}

export async function revokeOtherSessionsAction(): Promise<FormState> {
  const locale = await getLocale();
  const result = await requireSession(await accountCall("POST", "/user/auth/sessions/revoke-others", revokedSchema, { locale }), "/account/security");
  if (!result.ok) return failure(result.error);
  return redirect({ href: `/account/security?sessions=others&count=${result.data.revoked}#sessions`, locale });
}

/* ----------------------------- addresses ----------------------------- */

const ADDRESS_FIELDS = [
  ["label", 50],
  ["recipient_name", 150],
  ["recipient_phone", 30],
  ["address_line_1", 255],
  ["address_line_2", 255],
  ["building", 50],
  ["floor", 20],
  ["unit", 50],
  ["postal_code", 20],
  ["delivery_instructions", 500],
] as const;

export async function saveAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = Number(text(form, "address_id", 20)) || null;
  const values: Record<string, string> = {};
  for (const [field, max] of ADDRESS_FIELDS) values[field] = text(form, field, max);
  for (const field of ["country_id", "region_id", "city_id"]) values[field] = text(form, field, 12);

  const body: Record<string, unknown> = {};
  for (const [field] of ADDRESS_FIELDS) body[field] = values[field] || null;
  for (const field of ["country_id", "region_id", "city_id"]) body[field] = Number(values[field]) || null;

  const back = id ? `/account/addresses/${id}/edit` : "/account/addresses/new";
  const result = await requireSession(
    await accountCall(id ? "PUT" : "POST", id ? `/user/addresses/${id}` : "/user/addresses", addressSchema, { locale, body }),
    back,
  );
  if (!result.ok) return failure(result.error, values);

  if (form.get("make_default") === "on" && !result.data.is_default) {
    await accountCall("PUT", `/user/addresses/${result.data.id}/default`, anySchema, { locale });
  }
  // Came from checkout (or another safe page)? Go back there with this address selected.
  const next = safeNext(form.get("next"), "");
  if (next) return redirect({ href: next.includes("?") ? next : `${next}?address=${result.data.id}`, locale });
  return redirect({ href: `/account/addresses?saved=${id ? "updated" : "created"}`, locale });
}

export async function deleteAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = Number(text(form, "address_id", 20));
  if (!Number.isInteger(id) || id <= 0) return { status: "error" };
  const result = await requireSession(await accountCall("DELETE", `/user/addresses/${id}`, anySchema, { locale }), "/account/addresses");
  if (!result.ok) return failure(result.error);
  return redirect({ href: "/account/addresses?saved=deleted", locale });
}

/* ------------------------------ orders ------------------------------ */

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cancels the customer's own UNPAID order; the API decides (409 + its message otherwise). */
export async function cancelOrderAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = text(form, "order_id", 36);
  if (!ORDER_ID.test(id)) return { status: "error" };
  const result = await requireSession(await accountCall("POST", `/user/orders/${id}/cancel`, anySchema, { locale }), `/account/orders/${id}`);
  if (!result.ok) return failure(result.error);
  refreshAccount();
  return redirect({ href: `/account/orders/${id}?cancelled=1`, locale });
}

export async function setDefaultAddressAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = Number(text(form, "address_id", 20));
  if (!Number.isInteger(id) || id <= 0) return { status: "error" };
  const result = await requireSession(await accountCall("PUT", `/user/addresses/${id}/default`, anySchema, { locale }), "/account/addresses");
  if (!result.ok) return failure(result.error);
  return redirect({ href: "/account/addresses?saved=default", locale });
}
