import type { Payment, Quote } from "./schemas";

/** store id → shipping method id */
export type ShippingSelections = Record<number, number>;

/**
 * The shipping choice per store: keep what the server already has selected,
 * otherwise preselect the store's first offered option (the backend orders
 * them). Stores that offer nothing stay unselected — the quote's blockers
 * then explain why the order can't be placed.
 */
export function defaultSelections(quote: Quote, current: ShippingSelections = {}): ShippingSelections {
  const out: ShippingSelections = {};
  for (const store of quote.stores) {
    const offered = store.shipping_options.map((o) => o.shipping_method_id);
    const wanted = current[store.store.id] ?? store.selected_shipping?.shipping_method_id;
    if (wanted !== undefined && offered.includes(wanted)) out[store.store.id] = wanted;
    else if (offered.length) out[store.store.id] = offered[0];
  }
  return out;
}

export function selectionsPayload(selections: ShippingSelections) {
  return Object.entries(selections).map(([storeId, methodId]) => ({ store_id: Number(storeId), shipping_method_id: methodId }));
}

/** Parse `shipping[<storeId>]=<methodId>` form fields; anything else is ignored. */
export function selectionsFromForm(form: FormData): ShippingSelections {
  const out: ShippingSelections = {};
  for (const [key, value] of form.entries()) {
    const match = /^shipping\[(\d{1,12})\]$/.exec(key);
    const method = typeof value === "string" && /^\d{1,12}$/.test(value) ? Number(value) : NaN;
    if (match && Number.isInteger(method) && method > 0) out[Number(match[1])] = method;
  }
  return out;
}

/** Every blocker the customer must resolve, order-level first, without duplicates. */
export function allBlockers(quote: Quote): string[] {
  const messages = [
    ...quote.blockers.map((b) => b.message),
    ...quote.stores.flatMap((s) => [...s.blockers.map((b) => b.message), ...s.items.flatMap((i) => i.blockers.map((b) => b.message))]),
  ];
  return [...new Set(messages)];
}

/**
 * A provider redirect is followed by the customer's browser, so only an
 * absolute https URL is ever used (never javascript:, data:, relative or
 * plain http).
 */
export function safeActionUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export type PaymentState =
  | { kind: "paid" }
  | { kind: "action"; url: string; method: string | null }
  | { kind: "processing" }
  | { kind: "failed" }
  | { kind: "unpaid" };

/** What the order page should offer, from the backend's payment record (null = never started). */
export function paymentState(orderPaymentStatus: string, payment: Payment | null): PaymentState {
  if (orderPaymentStatus === "paid" || payment?.status === "succeeded") return { kind: "paid" };
  if (!payment) return { kind: "unpaid" };
  const attempt = payment.current_attempt;
  const url = safeActionUrl(attempt?.action?.url);
  if (attempt?.status === "requires_action" && url) return { kind: "action", url, method: payment.payment_method?.name ?? null };
  if (attempt?.status === "failed" || payment.status === "failed") return { kind: "failed" };
  // pending / processing: the provider has not answered yet (only its webhook decides).
  if (attempt) return { kind: "processing" };
  return { kind: "unpaid" };
}

/** A fresh idempotency key for one checkout / payment form (server-generated). */
export function newIdempotencyKey(prefix: "order" | "pay"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
