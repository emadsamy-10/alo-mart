import { describe, expect, it } from "vitest";
import {
  clampQuantity,
  findVariant,
  initialSelection,
  selectValue,
  valueState,
  variantAxes,
  variantLabel,
  variantPrice,
  type VariantLike,
} from "@/features/products/variants";

const color = (id: number, name: string, hex: string | null) => ({
  attribute: { id: 5, name: "Color", code: "color", input_type: "color" },
  value: { id, name, code: name.toLowerCase(), display_value: hex },
});
const size = (id: number, name: string) => ({
  attribute: { id: 9, name: "Size", code: "size", input_type: "select" },
  value: { id, name, code: name.toLowerCase(), display_value: null },
});
const v = (id: number, options: VariantLike["options"], extra: Partial<VariantLike> = {}): VariantLike => ({
  id,
  sku: `SKU-${id}`,
  price: "449.0000",
  sale_price: null,
  is_in_stock: true,
  options,
  ...extra,
});

// Black: S, M (M out of stock). White: M only. (White/S does not exist.)
const variants = [
  v(1, [color(28, "Black", "#1F1F1F"), size(1, "S")]),
  v(2, [color(28, "Black", "#1F1F1F"), size(2, "M")], { is_in_stock: false }),
  v(3, [color(29, "White", "#F5F5F2"), size(2, "M")], { price: "500.0000", sale_price: "450.0000" }),
];

describe("variantAxes", () => {
  it("discovers attributes and values from the API options, in order", () => {
    const axes = variantAxes(variants);
    expect(axes.map((a) => a.name)).toEqual(["Color", "Size"]);
    expect(axes[0].values.map((x) => x.name)).toEqual(["Black", "White"]);
    expect(axes[1].values.map((x) => x.name)).toEqual(["S", "M"]);
  });

  it("uses swatches only when every value has a valid color", () => {
    expect(variantAxes(variants)[0].kind).toBe("swatch");
    expect(variantAxes(variants)[1].kind).toBe("buttons");
    const bad = [v(1, [color(1, "Red", "red")]), v(2, [color(2, "Blue", "#00f")])];
    expect(variantAxes(bad)[0].kind).toBe("buttons");
  });

  it("returns no axes for a simple product", () => {
    expect(variantAxes([v(7, [])])).toEqual([]);
  });
});

describe("selection", () => {
  const axes = variantAxes(variants);

  it("starts on the first in-stock variant", () => {
    expect(initialSelection(variants)).toEqual({ 5: 28, 9: 1 });
    expect(initialSelection([v(1, [size(1, "S")], { is_in_stock: false }), v(2, [size(2, "M")])])).toEqual({ 9: 2 });
  });

  it("finds the variant for a complete selection, null when incomplete", () => {
    expect(findVariant(variants, axes, { 5: 29, 9: 2 })?.id).toBe(3);
    expect(findVariant(variants, axes, { 5: 29 })).toBeNull();
  });

  it("resolves a simple product without any selection", () => {
    expect(findVariant([v(7, [])], [], {})?.id).toBe(7);
  });

  it("marks invalid combinations unavailable and out-of-stock ones as such", () => {
    const blackS = { 5: 28, 9: 1 };
    expect(valueState(variants, axes, blackS, 9, 2)).toBe("out_of_stock"); // Black/M
    expect(valueState(variants, axes, { 5: 29, 9: 2 }, 9, 1)).toBe("unavailable"); // White/S doesn't exist
  });

  it("never deadlocks: earlier axes stay selectable whatever is chosen later", () => {
    // Black/S chosen: White must remain reachable (White/M exists).
    expect(valueState(variants, axes, { 5: 28, 9: 1 }, 5, 29)).toBe("available");
  });

  it("drops choices that a new choice makes impossible", () => {
    // Black/S selected → choose White: S is impossible with White, so Size resets.
    expect(selectValue(variants, axes, { 5: 28, 9: 1 }, 5, 29)).toEqual({ 5: 29 });
    // Black/S → choose M: still Black.
    expect(selectValue(variants, axes, { 5: 28, 9: 1 }, 9, 2)).toEqual({ 9: 2, 5: 28 });
  });
});

describe("price & label", () => {
  it("uses the sale price only when it is a real reduction", () => {
    expect(variantPrice(variants[2])).toEqual({ amount: "450.0000", regular: "500.0000" });
    expect(variantPrice(variants[0])).toEqual({ amount: "449.0000", regular: null });
    expect(variantPrice(v(9, [], { price: "100", sale_price: "120" }))).toEqual({ amount: "100", regular: null });
  });

  it("labels the variant in axis order", () => {
    expect(variantLabel(variants[2], variantAxes(variants))).toBe("White / M");
  });
});

describe("clampQuantity", () => {
  it("keeps quantities between 1 and 99", () => {
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-4)).toBe(1);
    expect(clampQuantity(2.7)).toBe(2);
    expect(clampQuantity(500)).toBe(99);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});
