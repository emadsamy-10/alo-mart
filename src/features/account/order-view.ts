import type { Order } from "./schemas";

/**
 * What the order page shows, derived ONLY from the API's own fields — the
 * website never infers a payment or fulfillment result. Payment status and
 * fulfillment status stay separate; an API without the lifecycle fields
 * yields no deadline, no cancel action and no lifecycle notice.
 */
export type OrderNotice =
  | { kind: "cancelled"; by: "payment_expired" | "customer_requested" | "merchant_cancelled" | "admin_cancelled" | "other" }
  | { kind: "paymentExpired" }
  | { kind: "latePayment" }
  | { kind: "refundReview" };

export type PaymentLabel = "paid" | "unpaid" | "paidAfterCancellation" | "notPaid";

export interface OrderView {
  /** The payment panel (start / resume / result) is shown. */
  payable: boolean;
  /** "Pay by …" deadline to show (ISO), only while the order is payable. */
  payBy: string | null;
  canCancel: boolean;
  paymentLabel: PaymentLabel;
  notices: OrderNotice[];
}

const REASONS = new Set(["payment_expired", "customer_requested", "merchant_cancelled", "admin_cancelled"]);

export function orderView(order: Pick<Order, "status" | "payment_status" | "payment_due_at" | "payment_expired" | "cancellation_reason" | "refund_status" | "can_cancel">): OrderView {
  const cancelled = order.status === "cancelled";
  const awaitingPayment = order.status === "placed" && order.payment_status === "unpaid";
  const payable = awaitingPayment && !order.payment_expired;
  const notices: OrderNotice[] = [];

  if (order.payment_status === "paid_after_cancellation") notices.push({ kind: "latePayment" });
  if (cancelled) {
    const reason = order.cancellation_reason ?? "";
    notices.push({ kind: "cancelled", by: REASONS.has(reason) ? (reason as "payment_expired") : "other" });
  } else if (awaitingPayment && order.payment_expired) {
    notices.push({ kind: "paymentExpired" });
  }
  if (order.refund_status && order.payment_status !== "paid_after_cancellation") notices.push({ kind: "refundReview" });

  const paymentLabel: PaymentLabel =
    order.payment_status === "paid" ? "paid" : order.payment_status === "paid_after_cancellation" ? "paidAfterCancellation" : cancelled ? "notPaid" : "unpaid";

  return {
    payable,
    payBy: payable ? (order.payment_due_at ?? null) : null,
    // Past the deadline the expiry job cancels it; no button to race it.
    canCancel: order.can_cancel && payable,
    paymentLabel,
    notices,
  };
}
