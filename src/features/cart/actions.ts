"use server";

import { getLocale } from "next-intl/server";
import { resolveMarket } from "@/features/markets/api";
import { getProduct } from "@/features/products/api";
import { priceViewFromDetail } from "@/features/products/pricing";
import { variantPrice } from "@/features/products/variants";
import { productCardImage } from "@/lib/images";
import type { LineRefresh } from "./cart";

const MAX_ITEMS = 60;
const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/;

/**
 * Re-read current prices and availability for locally stored cart lines,
 * from the public catalog, in the shopper's current market (cookie). Read-only;
 * nothing is reserved. Unknown/unpublished products report "unavailable".
 */
export async function refreshCartLines(lines: { slug: string; variantId: number }[]): Promise<LineRefresh[]> {
  const safe = lines.filter((l) => SLUG.test(l.slug) && Number.isInteger(l.variantId)).slice(0, MAX_ITEMS);
  const locale = await getLocale();
  const market = await resolveMarket(locale);
  const slugs = [...new Set(safe.map((l) => l.slug))];
  const products = new Map(await Promise.all(slugs.map(async (slug) => [slug, await getProduct(locale, market.code, slug)] as const)));

  return safe.map(({ slug, variantId }): LineRefresh => {
    const result = products.get(slug);
    // An outage is not "unavailable": keep the snapshot untouched.
    if (!result || (!result.ok && result.error.kind !== "not_found")) return { variantId, status: "ok" };
    if (!result.ok) return { variantId, status: "unavailable" };
    const variant = result.data.variants.find((v) => v.id === variantId);
    if (!variant) return { variantId, status: "unavailable" };
    if (!variant.is_in_stock) return { variantId, status: "out_of_stock" };
    const { amount, regular } = variantPrice(variant);
    if (!amount) return { variantId, status: "unavailable" };
    return { variantId, status: "ok", unitPrice: amount, regularPrice: regular };
  });
}

export interface WishlistSnapshot {
  slug: string;
  status: "ok" | "unavailable" | "error";
  name?: string;
  imageUrl?: string | null;
  inStock?: boolean;
  price?: { amount: string; maxAmount: string | null; regularAmount: string | null; currency: { code: string; symbol: string | null; decimal_places: number } } | null;
}

/** Current-market details for saved products (wishlist page). */
export async function refreshWishlist(slugs: string[]): Promise<WishlistSnapshot[]> {
  const safe = [...new Set(slugs.filter((s) => SLUG.test(s)))].slice(0, MAX_ITEMS);
  const locale = await getLocale();
  const market = await resolveMarket(locale);
  return Promise.all(
    safe.map(async (slug): Promise<WishlistSnapshot> => {
      const result = await getProduct(locale, market.code, slug);
      if (!result.ok) return { slug, status: result.error.kind === "not_found" ? "unavailable" : "error" };
      const p = result.data;
      const primary = [...p.media].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
      const image = primary ? productCardImage({ primary_image_url: primary.url ?? null, primary_image: primary }, "card") : null;
      const price = priceViewFromDetail(p);
      return {
        slug,
        status: "ok",
        name: p.name,
        imageUrl: image?.src ?? null,
        inStock: p.is_in_stock,
        price: price ? { amount: price.amount, maxAmount: price.maxAmount, regularAmount: price.regularAmount, currency: price.currency } : null,
      };
    }),
  );
}
