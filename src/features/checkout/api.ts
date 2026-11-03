import "server-only";
import { accountCall } from "@/features/account/session";
import { selectionsPayload, type ShippingSelections } from "./model";
import { paymentMethodsSchema, paymentSchema, quoteSchema } from "./schemas";

/** Server-calculated quote for the signed-in customer's cart in this market (never cached). */
export function getQuote(locale: string, market: string, addressId: number, selections: ShippingSelections = {}) {
  const shipping = selectionsPayload(selections);
  return accountCall("POST", "/user/checkout/quote", quoteSchema, {
    locale,
    body: { market, address_id: addressId, ...(shipping.length ? { shipping_selections: shipping } : {}) },
  });
}

/** Payment methods usable now in this market (codes + names only; providers stay server-side). */
export function getPaymentMethods(locale: string, market: string) {
  return accountCall("GET", "/user/payment-methods", paymentMethodsSchema, { locale, query: { market } });
}

/** The order's payment record; `not_found` = no payment started yet. */
export function getPayment(locale: string, orderId: string) {
  return accountCall("GET", `/user/orders/${orderId}/payment`, paymentSchema, { locale });
}
