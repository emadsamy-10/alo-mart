"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { clearSessionToken, accountCall } from "@/features/account/session";
import { text, type FormState } from "@/features/account/form-state";
import { loginHref } from "@/features/account/redirect";
import { resolveMarket } from "@/features/markets/api";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { getQuote } from "./api";
import { selectionsFromForm, selectionsPayload, type ShippingSelections } from "./model";
import { paymentSchema, placedOrderSchema, type Quote } from "./schemas";

/*
 * Checkout mutations. Everything payable is decided by the API: the
 * storefront sends only ids (address, shipping method per store, payment
 * method code) plus an idempotency key, never prices or totals.
 */

const KEY = /^(order|pay)-[0-9a-f-]{36}$/;

async function context() {
  const locale = (await getLocale()) as Locale;
  const market = await resolveMarket(locale);
  return { locale, market: market.code };
}

async function signedOut(back: string): Promise<never> {
  await clearSessionToken();
  return redirect({ href: loginHref(back), locale: (await getLocale()) as Locale });
}

export type RequoteResult = { ok: true; quote: Quote } | { ok: false; message: string };

/** Recalculate after the customer changes the address or a shipping method. */
export async function requoteAction(addressId: number, selections: ShippingSelections): Promise<RequoteResult> {
  const { locale, market } = await context();
  const t = await getTranslations("Checkout.errors");
  if (!Number.isInteger(addressId) || addressId <= 0) return { ok: false, message: t("address") };
  const result = await getQuote(locale, market, addressId, selections);
  if (result.ok) return { ok: true, quote: result.data };
  if (result.error.kind === "unauthorized") return signedOut("/checkout");
  return { ok: false, message: result.error.kind === "validation" && result.error.message ? result.error.message : t("quote") };
}

/**
 * Place the order, then start its payment. A repeated submission with the
 * same idempotency key returns the SAME order (the API replays it), so a
 * double click, a retry after a timeout or a refresh can't create a second
 * order. If the payment can't start, the order still exists and can be paid
 * from its page.
 */
export async function placeOrderAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { locale, market } = await context();
  const t = await getTranslations("Checkout.errors");
  const key = text(form, "idempotency_key", 60);
  const addressId = Number(text(form, "address_id", 12));
  const method = text(form, "payment_method", 40);
  if (!KEY.test(key) || !Number.isInteger(addressId) || addressId <= 0) return { status: "error", message: t("address") };
  if (!method) return { status: "error", message: t("paymentMethod"), fieldErrors: { payment_method: t("paymentMethod") } };

  const placed = await accountCall("POST", "/user/orders", placedOrderSchema, {
    locale,
    body: { idempotency_key: key, market, address_id: addressId, shipping_selections: selectionsPayload(selectionsFromForm(form)) },
  });
  if (!placed.ok) {
    if (placed.error.kind === "unauthorized") return signedOut("/checkout");
    // The API's own localized messages; nothing was placed and the cart is unchanged.
    if (placed.error.code === "email_unverified") return { status: "error", code: "email_unverified", message: placed.error.message ?? t("emailUnverified") };
    if (placed.error.code === "order_rate_limited") return { status: "error", code: "order_rate_limited", message: placed.error.message ?? t("rateLimited") };
    if (placed.error.kind === "conflict") return { status: "error", code: "conflict", message: placed.error.message ?? t("conflict") };
    if (placed.error.kind === "validation") return { status: "error", code: "not_ready", message: placed.error.message ?? t("notReady") };
    if (placed.error.kind === "rate_limited") return { status: "error", message: t("rateLimited") };
    return { status: "error", message: t("place") };
  }

  // Payment: its own idempotency key, derived from the order's (same retry semantics).
  const payment = await accountCall("POST", `/user/orders/${placed.data.id}/payment`, paymentSchema, {
    locale,
    body: { payment_method: method, idempotency_key: key.replace(/^order-/, "pay-") },
  });
  const paymentFlag = payment.ok ? "" : "&payment=failed";
  return redirect({ href: `/account/orders/${placed.data.id}?placed=1${paymentFlag}`, locale });
}

/** Start (or retry) the payment of an existing unpaid order from its page. */
export async function payOrderAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { locale } = await context();
  const t = await getTranslations("Checkout.errors");
  const orderId = text(form, "order_id", 40);
  const key = text(form, "idempotency_key", 60);
  const method = text(form, "payment_method", 40);
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !KEY.test(key)) return { status: "error", message: t("payment") };
  if (!method) return { status: "error", message: t("paymentMethod"), fieldErrors: { payment_method: t("paymentMethod") } };

  const result = await accountCall("POST", `/user/orders/${orderId}/payment`, paymentSchema, { locale, body: { payment_method: method, idempotency_key: key } });
  if (!result.ok) {
    if (result.error.kind === "unauthorized") return signedOut(`/account/orders/${orderId}`);
    return { status: "error", message: result.error.message && result.error.kind !== "server" ? result.error.message : t("payment") };
  }
  return redirect({ href: `/account/orders/${orderId}?payment=started`, locale });
}
