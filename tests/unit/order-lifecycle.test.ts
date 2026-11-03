import { describe, expect, it } from "vitest";
import { orderView } from "@/features/account/order-view";
import { orderSchema } from "@/features/account/schemas";
import cancelledOrder from "./fixtures/orders/cancelled-expired.json";
import lateOrder from "./fixtures/orders/late-payment.json";
import placedOrder from "./fixtures/orders/placed-unpaid.json";
import refundOrder from "./fixtures/orders/store-cancelled-refund.json";

/** Real `GET /user/orders/{id}` responses captured from the local lifecycle API. */
describe("order lifecycle contract", () => {
  it("parses every lifecycle state the API returns", () => {
    for (const fixture of [placedOrder, cancelledOrder, lateOrder, refundOrder]) {
      const parsed = orderSchema.parse(fixture.data);
      expect(parsed.stores.length).toBeGreaterThan(0);
      for (const store of parsed.stores) expect(typeof store.status).toBe("string");
    }
  });

  it("an API without lifecycle fields parses to no deadline, no cancel action and no notices", () => {
    const { payment_due_at, payment_expired, cancelled_at, cancellation_reason, refund_status, can_cancel, ...legacy } = placedOrder.data as Record<string, unknown>;
    void [payment_due_at, payment_expired, cancelled_at, cancellation_reason, refund_status, can_cancel];
    const parsed = orderSchema.parse(legacy);
    expect([parsed.payment_due_at, parsed.payment_expired, parsed.can_cancel]).toEqual([null, false, false]);
    expect(orderView(parsed)).toEqual({ payable: true, payBy: null, canCancel: false, paymentLabel: "unpaid", notices: [] });
  });
});

describe("orderView", () => {
  const base = { status: "placed", payment_status: "unpaid", payment_due_at: "2026-10-30T12:00:00+00:00", payment_expired: false, cancellation_reason: null, refund_status: null, can_cancel: true };

  it("an unpaid placed order is payable with a deadline and can be cancelled", () => {
    expect(orderView(orderSchema.parse(placedOrder.data))).toMatchObject({ payable: true, canCancel: true, paymentLabel: "unpaid", notices: [] });
    expect(orderView(base).payBy).toBe("2026-10-30T12:00:00+00:00");
  });

  it("past the deadline: no payment, no cancel button, an expiry notice", () => {
    expect(orderView({ ...base, payment_expired: true })).toEqual({ payable: false, payBy: null, canCancel: false, paymentLabel: "unpaid", notices: [{ kind: "paymentExpired" }] });
  });

  it("a cancelled order explains why and is never payable", () => {
    const view = orderView(orderSchema.parse(cancelledOrder.data));
    expect(view).toEqual({ payable: false, payBy: null, canCancel: false, paymentLabel: "notPaid", notices: [{ kind: "cancelled", by: "payment_expired" }] });
    for (const by of ["customer_requested", "merchant_cancelled", "admin_cancelled"] as const) {
      expect(orderView({ ...base, status: "cancelled", cancellation_reason: by, can_cancel: false }).notices).toEqual([{ kind: "cancelled", by }]);
    }
    expect(orderView({ ...base, status: "cancelled", cancellation_reason: "something_new", can_cancel: false }).notices).toEqual([{ kind: "cancelled", by: "other" }]);
  });

  it("a payment received after cancellation is shown as a refund under review, never as paid", () => {
    const view = orderView(orderSchema.parse(lateOrder.data));
    expect(view.paymentLabel).toBe("paidAfterCancellation");
    expect(view.payable).toBe(false);
    expect(view.notices).toEqual([{ kind: "latePayment" }, { kind: "cancelled", by: "customer_requested" }]);
  });

  it("a paid order with a store cancelled after payment keeps payment and fulfillment separate", () => {
    const parsed = orderSchema.parse(refundOrder.data);
    const view = orderView(parsed);
    expect(view).toEqual({ payable: false, payBy: null, canCancel: false, paymentLabel: "paid", notices: [{ kind: "cancelled", by: "merchant_cancelled" }, { kind: "refundReview" }] });
    expect(parsed.stores.map((s) => s.status)).toContain("cancelled");
    expect(parsed.stores.find((s) => s.status === "cancelled")?.refund?.status).toBe("pending_manual_review");
  });

  it("the cancel action is never offered for anything but an unpaid placed order, whatever the flag says", () => {
    expect(orderView({ ...base, status: "confirmed", payment_status: "paid", can_cancel: true }).canCancel).toBe(false);
    expect(orderView({ ...base, can_cancel: false }).canCancel).toBe(false);
  });
});
