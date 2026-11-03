import { describe, expect, it } from "vitest";
import { allBlockers, defaultSelections, newIdempotencyKey, paymentState, safeActionUrl, selectionsFromForm, selectionsPayload } from "@/features/checkout/model";
import { paymentMethodsSchema, paymentSchema, placedOrderSchema, quoteSchema } from "@/features/checkout/schemas";
import quoteJson from "./fixtures/checkout/quote.json";
import quoteSelectedJson from "./fixtures/checkout/quote-selected.json";
import quoteEmptyJson from "./fixtures/checkout/quote-empty-cart.json";
import methodsJson from "./fixtures/checkout/payment-methods.json";
import placedJson from "./fixtures/checkout/order-placed.json";
import replayedJson from "./fixtures/checkout/order-replayed.json";
import paymentInitiatedJson from "./fixtures/checkout/payment-initiated.json";
import paymentAfterJson from "./fixtures/checkout/payment-after.json";

const quote = quoteSchema.parse(quoteJson.data);
const selected = quoteSchema.parse(quoteSelectedJson.data);

describe("checkout schemas (real local-API responses)", () => {
  it("parses a quote before shipping is chosen: not ready, no grand total, a blocker per store", () => {
    expect(quote.checkout_ready).toBe(false);
    expect(quote.grand_total).toBeNull();
    expect(quote.stores.length).toBeGreaterThan(0);
    expect(quote.stores[0].shipping_options.length).toBeGreaterThan(0);
    expect(quote.stores[0].blockers[0].code).toBe("shipping_method_required");
  });

  it("parses a ready quote with server totals and tax", () => {
    expect(selected.checkout_ready).toBe(true);
    expect(selected.grand_total).toBe("2939.00");
    expect(selected.tax_calculated).toBe(true);
    expect(selected.tax?.price_includes_tax).toBe(true);
    expect(selected.stores.every((s) => s.selected_shipping !== null)).toBe(true);
  });

  it("parses an empty-cart quote", () => {
    const empty = quoteSchema.parse(quoteEmptyJson.data);
    expect(empty.item_count).toBe(0);
    expect(empty.stores).toEqual([]);
  });

  it("parses payment methods (codes and names only), placed and replayed orders", () => {
    expect(paymentMethodsSchema.parse(methodsJson.data)).toEqual([{ code: "card", name: "Card (sandbox)" }]);
    const placed = placedOrderSchema.parse(placedJson.data);
    // Same idempotency key → the API replays the SAME order.
    expect(placedOrderSchema.parse(replayedJson.data).id).toBe(placed.id);
    expect(replayedJson.http).toBe(200);
    expect(placedJson.http).toBe(201);
  });
});

describe("shipping selections", () => {
  it("preselects each store's first offered option", () => {
    const sel = defaultSelections(quote);
    for (const store of quote.stores) expect(sel[store.store.id]).toBe(store.shipping_options[0].shipping_method_id);
  });

  it("keeps a still-offered choice and replaces one that is no longer offered", () => {
    const store = quote.stores[0];
    const offered = store.shipping_options[0].shipping_method_id;
    expect(defaultSelections(quote, { [store.store.id]: offered })[store.store.id]).toBe(offered);
    expect(defaultSelections(quote, { [store.store.id]: 999999 })[store.store.id]).toBe(offered);
  });

  it("leaves stores that offer nothing unselected", () => {
    const none = { ...quote, stores: [{ ...quote.stores[0], shipping_options: [], selected_shipping: null }] };
    expect(defaultSelections(none)).toEqual({});
  });

  it("round-trips through form fields and ignores anything else", () => {
    const form = new FormData();
    form.set("shipping[3]", "2");
    form.set("shipping[7]", "9");
    form.set("shipping[x]", "1");
    form.set("shipping[4]", "1; DROP");
    form.set("price", "0.01");
    const sel = selectionsFromForm(form);
    expect(sel).toEqual({ 3: 2, 7: 9 });
    expect(selectionsPayload(sel)).toEqual([
      { store_id: 3, shipping_method_id: 2 },
      { store_id: 7, shipping_method_id: 9 },
    ]);
  });

  it("collects every blocker once, order-level first", () => {
    const withItem = {
      ...quote,
      blockers: [{ code: "x", message: "Order blocker" }],
      stores: quote.stores.map((s, i) => (i === 0 ? { ...s, items: s.items.map((it) => ({ ...it, blockers: [{ code: "oos", message: "Out of stock" }] })) } : s)),
    };
    const list = allBlockers(withItem);
    expect(list[0]).toBe("Order blocker");
    expect(list).toContain("Out of stock");
    expect(new Set(list).size).toBe(list.length);
  });
});

describe("payment state", () => {
  const initiated = paymentSchema.parse(paymentInitiatedJson.data);
  const after = paymentSchema.parse(paymentAfterJson.data);

  it("offers the provider redirect while the payment needs the customer", () => {
    expect(paymentState("unpaid", initiated)).toEqual({ kind: "action", url: initiated.current_attempt!.action!.url, method: "Card (sandbox)" });
  });

  it("shows paid only from the backend's record", () => {
    expect(paymentState("paid", null)).toEqual({ kind: "paid" });
    expect(paymentState("unpaid", after)).toEqual({ kind: "paid" });
  });

  it("never-started, failed and in-flight payments", () => {
    expect(paymentState("unpaid", null)).toEqual({ kind: "unpaid" });
    const failed = { ...initiated, status: "failed", current_attempt: { ...initiated.current_attempt!, status: "failed", action: null } };
    expect(paymentState("unpaid", failed)).toEqual({ kind: "failed" });
    const processing = { ...initiated, status: "processing", current_attempt: { ...initiated.current_attempt!, status: "processing", action: null } };
    expect(paymentState("unpaid", processing)).toEqual({ kind: "processing" });
  });

  it("refuses an unsafe provider redirect instead of following it", () => {
    for (const url of ["javascript:alert(1)", "http://pay.example/x", "data:text/html,x", "/relative", "https://user:pw@pay.example/x", ""]) {
      expect(safeActionUrl(url)).toBeNull();
    }
    expect(safeActionUrl("https://pay.example/session/1")).toBe("https://pay.example/session/1");
    const bad = { ...initiated, current_attempt: { ...initiated.current_attempt!, action: { type: "redirect", url: "javascript:alert(1)" } } };
    expect(paymentState("unpaid", bad).kind).toBe("processing");
  });
});

describe("idempotency keys", () => {
  it("are fresh, prefixed and accepted by the API's key rule", () => {
    const a = newIdempotencyKey("order");
    const b = newIdempotencyKey("order");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^order-[0-9a-f-]{36}$/);
    // Backend rule: ^[A-Za-z0-9][A-Za-z0-9._:-]*$, 8–100 chars.
    expect(a).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,99}$/);
    expect(a.replace(/^order-/, "pay-")).toMatch(/^pay-[0-9a-f-]{36}$/);
  });
});
