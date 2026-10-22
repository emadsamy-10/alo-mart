import "server-only";
import { env } from "@/lib/env";
import type { ProductCard } from "@/lib/api/schemas";
import { productCardImage } from "@/lib/images";
import { buildPageMetadata, type PageSeoInput, type SeoConfig } from "./metadata";

export const SITE_NAME = "ALO MART";

export const seoConfig: SeoConfig = {
  siteUrl: env.siteUrl,
  indexable: env.indexable,
  siteName: SITE_NAME,
};

/** The official brand image — the Open Graph fallback when a page has no image of its own. */
export function defaultOgImage(alt: string) {
  return { url: `${env.siteUrl}/brand/alo-mart-logo.jpeg`, width: 1254, height: 1254, alt };
}

/**
 * Open Graph image for listing pages: the entity's own image, else the first
 * real product photo shown on the page, else the brand image. Never invented.
 */
export function listingOgImage(
  own: string | null | undefined,
  firstProduct: Pick<ProductCard, "primary_image_url" | "primary_image"> | undefined,
  alt: string,
) {
  if (own) return { url: own, alt };
  const image = firstProduct ? productCardImage(firstProduct, "large") : null;
  if (image) return { url: image.src, width: image.width, height: image.height, alt };
  return defaultOgImage(alt);
}

export function pageMetadata(input: PageSeoInput) {
  return buildPageMetadata(seoConfig, input);
}
