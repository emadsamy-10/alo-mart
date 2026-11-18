"use server";

import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import type { AccountError, AccountResult } from "@/lib/api/account-client";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { firstErrors, text, type FormState } from "@/features/account/form-state";
import { loginHref, safeNext } from "@/features/account/redirect";
import { anySchema } from "@/features/account/schemas";
import { accountCall, clearSessionToken } from "@/features/account/session";
import { ownDesignSchema, ownProfileSchema, requestSchema } from "./schemas";

/*
 * Server Actions for designers, designs, subscriptions and Customer Plus.
 * The browser posts a form; the action calls the API with the token from the
 * httpOnly session cookie. Next rejects cross-origin Server Actions (CSRF).
 * The API enforces every rule (ownership, verification, entitlements,
 * limits); these actions only shape input and map the answers.
 */

function refresh() {
  revalidatePath("/[locale]", "layout");
}

/** Field errors for list inputs (`specialties.2`) are shown on the list field. */
function collapse(errors: Record<string, string[]> | undefined) {
  if (!errors) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(errors)) {
    const base = key.replace(/\.\d+$/, "");
    out[base] = [...(out[base] ?? []), ...messages];
  }
  return out;
}

async function failure(error: AccountError, values?: Record<string, string>): Promise<FormState> {
  const t = await getTranslations("Account.errors");
  const fieldErrors = firstErrors(collapse(error.errors));
  const message =
    error.kind === "rate_limited" ? t("rateLimited")
    : error.kind === "network" || error.kind === "timeout" ? t("network")
    : error.kind === "server" || error.kind === "invalid_response" ? t("server")
    : fieldErrors ? t("checkFields")
    : (error.message ?? t("server"));
  return { status: "error", message, code: error.code, fieldErrors, values };
}

async function requireSession<T>(result: AccountResult<T>, back: string): Promise<AccountResult<T>> {
  if (!result.ok && result.error.kind === "unauthorized") {
    await clearSessionToken();
    redirect({ href: loginHref(back), locale: (await getLocale()) as Locale });
  }
  return result;
}

function list(form: FormData, name: string, max: number, itemMax: number): string[] {
  return text(form, name, 2000)
    .split(/[\n,،]+/)
    .map((v) => v.trim().slice(0, itemMax))
    .filter(Boolean)
    .slice(0, max);
}

function positiveId(form: FormData, name: string): number | null {
  const id = Number(text(form, name, 20));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function imageFile(form: FormData, name = "image"): File | null {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

/* ------------------------------------------------------------ profile */

function profileBody(form: FormData) {
  return {
    display_name: text(form, "display_name", 80),
    headline: text(form, "headline", 140) || null,
    bio: text(form, "bio", 2000) || null,
    city: text(form, "city", 80) || null,
    specialties: list(form, "specialties", 8, 40),
    links: list(form, "links", 5, 255),
  };
}

function profileValues(form: FormData) {
  return {
    display_name: text(form, "display_name", 80),
    headline: text(form, "headline", 140),
    bio: text(form, "bio", 2000),
    city: text(form, "city", 80),
    specialties: text(form, "specialties", 500),
    links: text(form, "links", 1500),
  };
}

export async function applyDesignerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const result = await requireSession(await accountCall("POST", "/user/designer/apply", ownProfileSchema, { locale, body: profileBody(form) }), "/account/designer");
  if (!result.ok) return failure(result.error, profileValues(form));
  refresh();
  return redirect({ href: "/account/designer?applied=1", locale });
}

export async function updateDesignerProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.studio");
  const result = await requireSession(await accountCall("PUT", "/user/designer/profile", ownProfileSchema, { locale, body: profileBody(form) }), "/account/designer");
  if (!result.ok) return failure(result.error, profileValues(form));
  refresh();
  return { status: "success", message: t("profileSaved"), values: profileValues(form) };
}

export async function resubmitDesignerAction(): Promise<FormState> {
  const locale = await getLocale();
  const result = await requireSession(await accountCall("POST", "/user/designer/profile/resubmit", ownProfileSchema, { locale }), "/account/designer");
  if (!result.ok) return failure(result.error);
  refresh();
  return redirect({ href: "/account/designer?resubmitted=1", locale });
}

export async function uploadDesignerImageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.studio");
  const slot = text(form, "slot", 10) === "cover" ? "cover" : "avatar";
  const file = imageFile(form);
  if (!file) return { status: "error", message: t("chooseImage") };
  const body = new FormData();
  body.set("image", file);
  const result = await requireSession(await accountCall("POST", `/user/designer/profile/${slot}`, ownProfileSchema, { locale, body }), "/account/designer");
  if (!result.ok) return failure(result.error);
  refresh();
  return { status: "success", message: t("imageSaved") };
}

export async function removeDesignerImageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.studio");
  const slot = text(form, "slot", 10) === "cover" ? "cover" : "avatar";
  const result = await requireSession(await accountCall("DELETE", `/user/designer/profile/${slot}`, ownProfileSchema, { locale }), "/account/designer");
  if (!result.ok) return failure(result.error);
  refresh();
  return { status: "success", message: t("imageRemoved") };
}

/* ------------------------------------------------------------ designs */

function designBody(form: FormData) {
  return {
    title: text(form, "title", 120),
    description: text(form, "description", 5000) || null,
    category: text(form, "category", 40),
    tags: list(form, "tags", 10, 30),
    members_only: form.get("members_only") === "on",
  };
}

function designValues(form: FormData) {
  return {
    title: text(form, "title", 120),
    description: text(form, "description", 5000),
    category: text(form, "category", 40),
    tags: text(form, "tags", 400),
    members_only: form.get("members_only") === "on" ? "on" : "",
  };
}

export async function createDesignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const result = await requireSession(await accountCall("POST", "/user/designer/designs", ownDesignSchema, { locale, body: designBody(form) }), "/account/designer/designs/new");
  if (!result.ok) return failure(result.error, designValues(form));
  refresh();
  return redirect({ href: `/account/designer/designs/${result.data.id}?created=1`, locale });
}

export async function updateDesignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.studio");
  const id = positiveId(form, "design_id");
  if (!id) return { status: "error" };
  const result = await requireSession(await accountCall("PUT", `/user/designer/designs/${id}`, ownDesignSchema, { locale, body: designBody(form) }), `/account/designer/designs/${id}`);
  if (!result.ok) return failure(result.error, designValues(form));
  refresh();
  return { status: "success", message: t("designSaved"), values: designValues(form) };
}

export async function deleteDesignAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const id = positiveId(form, "design_id");
  if (!id) return { status: "error" };
  const result = await requireSession(await accountCall("DELETE", `/user/designer/designs/${id}`, anySchema, { locale }), `/account/designer/designs/${id}`);
  if (!result.ok) return failure(result.error);
  refresh();
  return redirect({ href: "/account/designer/designs?deleted=1", locale });
}

/** One media mutation on a design; the page re-renders with the new state. */
type StudioMessage = "imageSaved" | "videoSaved" | "mediaRemoved" | "coverSaved" | "orderSaved" | "submitted" | "withdrawn";

async function designMediaCall(form: FormData, call: (id: number, locale: string) => Promise<AccountResult<unknown>>, successKey: StudioMessage): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.studio");
  const id = positiveId(form, "design_id");
  if (!id) return { status: "error" };
  const result = await requireSession(await call(id, locale), `/account/designer/designs/${id}`);
  if (!result.ok) return failure(result.error, { url: text(form, "url", 500), alt_text: text(form, "alt_text", 200) });
  refresh();
  return { status: "success", message: t(successKey) };
}

export async function uploadDesignImageAction(_prev: FormState, form: FormData): Promise<FormState> {
  const file = imageFile(form);
  if (!file) {
    const t = await getTranslations("Designers.studio");
    return { status: "error", message: t("chooseImage") };
  }
  const body = new FormData();
  body.set("image", file);
  const alt = text(form, "alt_text", 200);
  if (alt) body.set("alt_text", alt);
  return designMediaCall(form, (id, locale) => accountCall("POST", `/user/designer/designs/${id}/images`, ownDesignSchema, { locale, body }), "imageSaved");
}

export async function addDesignVideoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const body = { url: text(form, "url", 500), title: text(form, "title", 200) || null };
  return designMediaCall(form, (id, locale) => accountCall("POST", `/user/designer/designs/${id}/videos`, ownDesignSchema, { locale, body }), "videoSaved");
}

export async function removeDesignMediaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const media = positiveId(form, "media_id");
  if (!media) return { status: "error" };
  return designMediaCall(form, (id, locale) => accountCall("DELETE", `/user/designer/designs/${id}/media/${media}`, ownDesignSchema, { locale }), "mediaRemoved");
}

export async function setDesignCoverAction(_prev: FormState, form: FormData): Promise<FormState> {
  const media = positiveId(form, "media_id");
  if (!media) return { status: "error" };
  return designMediaCall(form, (id, locale) => accountCall("PUT", `/user/designer/designs/${id}/cover`, ownDesignSchema, { locale, body: { media_id: media } }), "coverSaved");
}

/** `order` is the full, comma-separated media id list in the new order (built from the current page state). */
export async function reorderDesignMediaAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ids = text(form, "order", 1000).split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return designMediaCall(form, (id, locale) => accountCall("PUT", `/user/designer/designs/${id}/media/order`, ownDesignSchema, { locale, body: { ids } }), "orderSaved");
}

export async function submitDesignAction(_prev: FormState, form: FormData): Promise<FormState> {
  return designMediaCall(form, (id, locale) => accountCall("POST", `/user/designer/designs/${id}/submit`, ownDesignSchema, { locale }), "submitted");
}

export async function withdrawDesignAction(_prev: FormState, form: FormData): Promise<FormState> {
  return designMediaCall(form, (id, locale) => accountCall("POST", `/user/designer/designs/${id}/withdraw`, ownDesignSchema, { locale }), "withdrawn");
}

/* ------------------------------------------------------------ subscriptions */

/** A REQUEST for an admin-granted plan. Nothing is charged; the API refuses unverified emails. */
export async function requestSubscriptionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const planId = positiveId(form, "plan_id");
  const period = text(form, "billing_period", 10);
  const back = safeNext(text(form, "back", 200), "/subscriptions");
  if (!planId || (period !== "monthly" && period !== "yearly")) return { status: "error" };
  const result = await requireSession(
    await accountCall("POST", "/user/subscription-requests", requestSchema, { locale, body: { plan_id: planId, billing_period: period, note: text(form, "note", 500) || null } }),
    back,
  );
  if (!result.ok) return failure(result.error, { note: text(form, "note", 500) });
  refresh();
  return redirect({ href: `/account/subscription?requested=${result.data.audience}`, locale });
}

export async function withdrawSubscriptionRequestAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.subscription");
  const id = positiveId(form, "request_id");
  if (!id) return { status: "error" };
  const result = await requireSession(await accountCall("POST", `/user/subscription-requests/${id}/withdraw`, anySchema, { locale }), "/account/subscription");
  if (!result.ok) return failure(result.error);
  refresh();
  return { status: "success", message: t("withdrawn") };
}

export async function cancelSubscriptionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const t = await getTranslations("Designers.subscription");
  const id = positiveId(form, "subscription_id");
  if (!id) return { status: "error" };
  const result = await requireSession(await accountCall("POST", `/user/subscriptions/${id}/cancel`, anySchema, { locale }), "/account/subscription");
  if (!result.ok) return failure(result.error);
  refresh();
  return { status: "success", message: t("cancelScheduled") };
}

/* ------------------------------------------------------------ Customer Plus */

const SLUG = /^[a-z0-9-]{1,140}$/;

/** Follow/unfollow a designer, save/unsave a design. `back` is where a guest returns after signing in. */
export async function toggleInspirationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const locale = await getLocale();
  const kind = text(form, "kind", 10) === "design" ? "designs" : "designers";
  const slug = text(form, "slug", 140);
  const on = text(form, "on", 5) === "1";
  const back = safeNext(text(form, "back", 300), "/designers");
  if (!SLUG.test(slug)) return { status: "error" };
  const result = await requireSession(await accountCall(on ? "POST" : "DELETE", `/user/inspiration/${kind}/${slug}`, anySchema, { locale }), back);
  if (!result.ok) return failure(result.error);
  revalidatePath("/[locale]/account/inspiration", "page");
  return { status: "success", values: { on: on ? "1" : "0" } };
}
