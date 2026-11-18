"use server";

import { getProduct } from "./api";
import { quickAddVariant, variantAxes, variantLabel, variantPrice } from "./variants";

export type QuickAddResult = { kind: "add"; variantId: number; variantLabel: string; unitPrice: string; regularPrice: string | null } | { kind: "choose" };

const SLUG = /^[\p{L}\p{N}-]{1,200}$/u;
const MARKET = /^[A-Z]{2,3}$/;

/**
 * What the card's cart button may do, from the live product (read-only): add
 * the product's only purchasable variant, or send the shopper to choose
 * options on the product page. Any doubt answers "choose".
 */
export async function quickAddOption(locale: string, market: string, slug: string): Promise<QuickAddResult> {
  if (!SLUG.test(slug) || !MARKET.test(market)) return { kind: "choose" };
  const product = await getProduct(locale, market, slug);
  if (!product.ok) return { kind: "choose" };
  const variant = quickAddVariant(product.data.variants);
  if (!variant) return { kind: "choose" };
  const { amount, regular } = variantPrice(variant);
  if (!amount) return { kind: "choose" };
  return { kind: "add", variantId: variant.id, variantLabel: variantLabel(variant, variantAxes(product.data.variants)), unitPrice: amount, regularPrice: regular };
}
