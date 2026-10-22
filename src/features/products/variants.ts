/**
 * Variant selection, driven entirely by the variants the API returns.
 * Attributes (Color, Size, Storage…) are discovered from the variants'
 * options — nothing is hardcoded. Pure functions; React-free and tested.
 */

export interface VariantLike {
  id: number;
  sku?: string | null;
  price: string | null;
  sale_price: string | null;
  is_in_stock: boolean;
  options: {
    attribute: { id: number; name: string; code: string; input_type: string };
    value: { id: number; name: string; code: string; display_value: string | null };
  }[];
}

export interface AxisValue {
  id: number;
  name: string;
  code: string;
  /** CSS color for swatches — only when the API provides a valid one. */
  swatch: string | null;
}

export interface VariantAxis {
  id: number;
  name: string;
  code: string;
  kind: "swatch" | "buttons";
  values: AxisValue[];
}

/** attribute id → value id */
export type Selection = Record<number, number>;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Axes in first-appearance order; values in first-appearance order. */
export function variantAxes(variants: VariantLike[]): VariantAxis[] {
  const axes = new Map<number, VariantAxis>();
  for (const variant of variants) {
    for (const { attribute, value } of variant.options) {
      let axis = axes.get(attribute.id);
      if (!axis) {
        axis = { id: attribute.id, name: attribute.name, code: attribute.code, kind: "buttons", values: [] };
        axes.set(attribute.id, axis);
      }
      if (!axis.values.some((v) => v.id === value.id)) {
        const swatch = attribute.input_type === "color" && value.display_value && HEX.test(value.display_value) ? value.display_value : null;
        axis.values.push({ id: value.id, name: value.name, code: value.code, swatch });
      }
    }
  }
  // Swatches only when EVERY value of the axis has a valid color.
  for (const axis of axes.values()) {
    axis.kind = axis.values.length > 0 && axis.values.every((v) => v.swatch) ? "swatch" : "buttons";
  }
  return [...axes.values()];
}

function matches(variant: VariantLike, selection: Selection): boolean {
  return Object.entries(selection).every(([attrId, valueId]) =>
    variant.options.some((o) => o.attribute.id === Number(attrId) && o.value.id === valueId),
  );
}

/** The variant matching a COMPLETE selection (every axis chosen), else null. */
export function findVariant(variants: VariantLike[], axes: VariantAxis[], selection: Selection): VariantLike | null {
  if (axes.some((axis) => selection[axis.id] === undefined)) return variants.length === 1 && axes.length === 0 ? variants[0] : null;
  return variants.find((v) => matches(v, selection)) ?? null;
}

export type ValueState = "available" | "out_of_stock" | "unavailable";

/**
 * What choosing `valueId` on `axisId` would lead to: a purchasable
 * variant, only out-of-stock variants, or no variant at all.
 *
 * Only choices on EARLIER axes constrain a value (Color narrows Size, not the
 * other way round). Checking against every other choice would deadlock: with
 * Black/S chosen, White would be disabled because White/S doesn't exist, even
 * though White/M does — the shopper could never reach it.
 */
export function valueState(variants: VariantLike[], axes: VariantAxis[], selection: Selection, axisId: number, valueId: number): ValueState {
  const position = axes.findIndex((a) => a.id === axisId);
  const candidate: Selection = { [axisId]: valueId };
  for (const axis of axes.slice(0, Math.max(0, position))) {
    if (selection[axis.id] !== undefined) candidate[axis.id] = selection[axis.id];
  }
  const reachable = variants.filter((v) => matches(v, candidate));
  if (reachable.length === 0) return "unavailable";
  return reachable.some((v) => v.is_in_stock) ? "available" : "out_of_stock";
}

/** Choosing a value may invalidate other choices; keep only those still reachable. */
export function selectValue(variants: VariantLike[], axes: VariantAxis[], selection: Selection, axisId: number, valueId: number): Selection {
  const next: Selection = { [axisId]: valueId };
  for (const axis of axes) {
    if (axis.id === axisId || selection[axis.id] === undefined) continue;
    const candidate = { ...next, [axis.id]: selection[axis.id] };
    if (variants.some((v) => matches(v, candidate))) next[axis.id] = selection[axis.id];
  }
  return next;
}

/** Start on the first in-stock variant (else the first one) so the page opens purchasable. */
export function initialSelection(variants: VariantLike[]): Selection {
  const start = variants.find((v) => v.is_in_stock) ?? variants[0];
  const selection: Selection = {};
  for (const o of start?.options ?? []) selection[o.attribute.id] = o.value.id;
  return selection;
}

/** Selling price of a variant: sale price when it is a real reduction, else the price. */
export function variantPrice(variant: VariantLike): { amount: string | null; regular: string | null } {
  const price = variant.price === null ? null : Number(variant.price);
  const sale = variant.sale_price === null ? null : Number(variant.sale_price);
  if (price !== null && sale !== null && Number.isFinite(sale) && sale < price) {
    return { amount: variant.sale_price, regular: variant.price };
  }
  return { amount: variant.price, regular: null };
}

/** "Black / L" — the chosen option values, in axis order. */
export function variantLabel(variant: VariantLike, axes: VariantAxis[]): string {
  return axes
    .map((axis) => variant.options.find((o) => o.attribute.id === axis.id)?.value.name)
    .filter(Boolean)
    .join(" / ");
}

/** Without stock counts from the API, quantities are clamped to a sane purchase range. */
export const MAX_QUANTITY = 99;
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value)));
}
