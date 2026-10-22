import { describe, expect, it } from "vitest";
import { priceViewFromCard, priceViewFromDetail } from "@/features/products/pricing";

const currency = { code: "EGP", symbol: "ج.م", decimal_places: 2 };
const card = { currency, price_from: "4350.0000", price_to: "4350.0000", has_price_range: false };

describe("priceViewFromCard", () => {
  it("single price, no invented previous price", () => {
    expect(priceViewFromCard(card)).toEqual({
      currency,
      amount: "4350.0000",
      maxAmount: null,
      regularAmount: null,
      discountPercent: null,
    });
  });

  it("price range", () => {
    const view = priceViewFromCard({ ...card, price_to: "5000.0000", has_price_range: true });
    expect(view?.maxAmount).toBe("5000.0000");
  });

  it("ignores a range flag when max is not above min", () => {
    expect(priceViewFromCard({ ...card, has_price_range: true })?.maxAmount).toBeNull();
  });

  it("uses the real deal from the API", () => {
    const view = priceViewFromCard({
      ...card,
      price_from: "590.0000",
      deal: { regular_price: "690.0000", sale_price: "590.0000", discount_percent: 14 },
    });
    expect(view).toMatchObject({ amount: "590.0000", regularAmount: "690.0000", discountPercent: 14 });
  });

  it("rejects a 'deal' that is not a reduction", () => {
    const view = priceViewFromCard({ ...card, deal: { regular_price: "100", sale_price: "100", discount_percent: 0 } });
    expect(view?.regularAmount).toBeNull();
    expect(view?.discountPercent).toBeNull();
  });

  it("returns null when the market has no price", () => {
    expect(priceViewFromCard({ ...card, price_from: null })).toBeNull();
  });
});

describe("priceViewFromDetail", () => {
  it("derives the deal from variants like the backend", () => {
    const view = priceViewFromDetail({
      ...card,
      price_from: "590.0000",
      price_to: "590.0000",
      variants: [{ price: "690.0000", sale_price: "590.0000" }],
    });
    expect(view).toMatchObject({ regularAmount: "690.0000", discountPercent: 14 });
  });

  it("does not attach a 'was' price to a price range", () => {
    const view = priceViewFromDetail({
      ...card,
      price_from: "590.0000",
      price_to: "900.0000",
      has_price_range: true,
      variants: [
        { price: "690.0000", sale_price: "590.0000" },
        { price: "900.0000", sale_price: null },
      ],
    });
    expect(view?.regularAmount).toBeNull();
  });
});
