import { describe, expect, it } from "vitest";
import { EMPTY_CART, addLine, applyRefresh, clearMarket, itemCount, parseCart, removeLine, setQuantity, subtotal, type CartLine } from "@/features/cart/cart";
import { EMPTY_WISHLIST, isSaved, parseWishlist, removeEntry, toggleEntry } from "@/features/wishlist/wishlist";

const EGP = { code: "EGP", symbol: "ج.م", decimal_places: 2 };
const line = (variantId: number, extra: Partial<CartLine> = {}): Omit<CartLine, "addedAt" | "issue"> => ({
  variantId,
  productId: 10,
  slug: "tee",
  name: "Tee",
  variantLabel: "Black / S",
  imageUrl: null,
  unitPrice: "449.0000",
  regularPrice: null,
  currency: EGP,
  quantity: 1,
  ...extra,
});

describe("cart", () => {
  it("adds a line and merges repeated additions of the same variant", () => {
    let s = addLine(EMPTY_CART, "EG", line(1, { quantity: 2 }));
    s = addLine(s, "EG", line(1, { quantity: 3 }));
    expect(s.EG).toHaveLength(1);
    expect(s.EG[0].quantity).toBe(5);
  });

  it("keeps different variants of one product as separate lines", () => {
    const s = addLine(addLine(EMPTY_CART, "EG", line(1)), "EG", line(2, { variantLabel: "White / M" }));
    expect(s.EG.map((l) => l.variantId)).toEqual([1, 2]);
  });

  it("isolates markets: an EG line never appears in the SA cart", () => {
    const s = addLine(EMPTY_CART, "EG", line(1));
    expect(s.SA).toBeUndefined();
    expect(clearMarket(s, "SA").EG).toHaveLength(1);
  });

  it("clamps quantities to 1..99 on add, merge and update", () => {
    let s = addLine(EMPTY_CART, "EG", line(1, { quantity: 0 }));
    expect(s.EG[0].quantity).toBe(1);
    s = addLine(s, "EG", line(1, { quantity: 200 }));
    expect(s.EG[0].quantity).toBe(99);
    s = setQuantity(s, "EG", 1, -3);
    expect(s.EG[0].quantity).toBe(1);
  });

  it("removes lines and reports an empty cart", () => {
    const s = removeLine(addLine(EMPTY_CART, "EG", line(1)), "EG", 1);
    expect(s.EG).toEqual([]);
    expect(itemCount(s.EG)).toBe(0);
    expect(subtotal(s.EG)).toBeNull();
  });

  it("computes an exact subtotal in minor units", () => {
    let s = addLine(EMPTY_CART, "EG", line(1, { unitPrice: "0.1000", quantity: 3 }));
    s = addLine(s, "EG", line(2, { unitPrice: "449.9900", quantity: 2 }));
    expect(subtotal(s.EG)).toEqual({ amount: "900.28", currency: EGP });
    expect(itemCount(s.EG)).toBe(5);
  });

  it("applies refreshed prices and flags stale lines, excluding them from the subtotal", () => {
    let s = addLine(addLine(EMPTY_CART, "EG", line(1)), "EG", line(2));
    s = applyRefresh(s, "EG", [
      { variantId: 1, status: "ok", unitPrice: "399.0000", regularPrice: "449.0000" },
      { variantId: 2, status: "out_of_stock" },
    ]);
    expect(s.EG[0]).toMatchObject({ unitPrice: "399.0000", regularPrice: "449.0000", issue: null });
    expect(s.EG[1].issue).toBe("out_of_stock");
    expect(subtotal(s.EG)?.amount).toBe("399.00");
  });

  it("rejects corrupt or foreign storage content", () => {
    expect(parseCart(null)).toEqual({});
    expect(parseCart([1, 2])).toEqual({});
    const good = { ...line(1), addedAt: 1 };
    expect(parseCart({ EG: [good, { variantId: "x" }], "bad key": [good] })).toEqual({ EG: [good] });
  });
});

describe("wishlist", () => {
  const entry = { productId: 7, slug: "desk", name: "Desk", imageUrl: null };

  it("toggles without ever duplicating", () => {
    let s = toggleEntry(EMPTY_WISHLIST, entry);
    expect(isSaved(s, 7)).toBe(true);
    s = toggleEntry(s, entry);
    expect(s).toEqual([]);
  });

  it("removes by product id and keeps newest first", () => {
    let s = toggleEntry(EMPTY_WISHLIST, entry, 1);
    s = toggleEntry(s, { ...entry, productId: 8, slug: "chair" }, 2);
    expect(s.map((e) => e.productId)).toEqual([8, 7]);
    expect(removeEntry(s, 8).map((e) => e.productId)).toEqual([7]);
  });

  it("drops malformed and duplicate stored entries", () => {
    const e = { ...entry, addedAt: 1 };
    expect(parseWishlist([e, e, { productId: "x" }, null])).toEqual([e]);
    expect(parseWishlist({})).toEqual([]);
  });
});
