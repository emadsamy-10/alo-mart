import type { MetadataRoute } from "next";
import { getBrands, getCategoryTree, type CategoryNode } from "@/features/catalog/api";
import { getDesigners, getDesigns } from "@/features/designers/api";
import { getProducts } from "@/features/products/api";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { env } from "@/lib/env";
import { defaultLocale, locales } from "@/lib/i18n/routing";
import { languageAlternates, localizedUrl } from "@/lib/seo/metadata";

/** Regenerated at most hourly. */
export const revalidate = 3600;

/** Safety cap: never page through an unbounded catalog in one request. */
const MAX_PRODUCT_PAGES = 50;
/** Designs and designers are read 48 per page here. */
const MAX_DESIGN_PAGES = 20;

/** One entry per language version (each its own <loc>), each listing every alternate. */
function entry(path: string, options: Partial<MetadataRoute.Sitemap[number]> = {}): MetadataRoute.Sitemap {
  const alternates = { languages: languageAlternates(env.siteUrl, path, locales) };
  return locales.map((locale) => ({ url: localizedUrl(env.siteUrl, locale, path), alternates, ...options }));
}

function flatten(nodes: CategoryNode[]): CategoryNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * Sitemap foundation over pages that exist today, for the DEFAULT market
 * (what crawlers see): homepage, categories, brands and stores with products, products.
 * Every language version is its own URL and lists its hreflang alternates.
 *
 * A failed API read THROWS instead of omitting that group: this route is
 * regenerated in the background (ISR), and when regeneration fails Next keeps
 * serving the last good sitemap — whereas a partial result would replace it
 * and drop every product URL for the length of an outage.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const market = env.defaultMarket;
  const entries: MetadataRoute.Sitemap = [
    ...entry("/", { changeFrequency: "daily", priority: 1 }),
    ...entry("/products", { changeFrequency: "daily", priority: 0.9 }),
    ...entry("/brands", { changeFrequency: "weekly", priority: 0.6 }),
  ];

  const tree = await getCategoryTree(defaultLocale, market);
  if (!tree.ok) throw new CatalogUnavailableError(tree.error.kind);
  for (const category of flatten(tree.data)) {
    entries.push(...entry(`/categories/${category.slug}`, { changeFrequency: "daily", priority: 0.7 }));
  }

  const products: { slug: string; brandSlug: string | null; storeSlug: string | null }[] = [];
  for (let page = 1; page <= MAX_PRODUCT_PAGES; page++) {
    const result = await getProducts(defaultLocale, market, { page, perPage: 100 });
    if (!result.ok) throw new CatalogUnavailableError(result.error.kind);
    for (const item of result.data.items) products.push({ slug: item.slug, brandSlug: item.brand?.slug ?? null, storeSlug: item.store?.slug ?? null });
    if (page >= result.data.meta.last_page) break;
  }
  for (const product of products) {
    entries.push(...entry(`/products/${product.slug}`, { changeFrequency: "daily", priority: 0.8 }));
  }

  // Only brands that actually have products in this market (no empty pages).
  const brands = await getBrands(defaultLocale);
  if (!brands.ok) throw new CatalogUnavailableError(brands.error.kind);
  const withProducts = new Set(products.map((p) => p.brandSlug).filter(Boolean));
  for (const brand of brands.data) {
    if (withProducts.has(brand.slug)) entries.push(...entry(`/brands/${brand.slug}`, { changeFrequency: "weekly", priority: 0.5 }));
  }

  // Stores: the directory, plus each store that has products in this market.
  entries.push(...entry("/stores", { changeFrequency: "weekly", priority: 0.5 }));
  const storesWithProducts = new Set(products.map((p) => p.storeSlug).filter(Boolean));
  for (const slug of storesWithProducts) entries.push(...entry(`/stores/${slug}`, { changeFrequency: "weekly", priority: 0.5 }));

  // Designers: the hub, the plans page, and only what the API lists publicly (approved designers with an
  // active Designer subscription, and their published designs). Drafts and private pages never appear.
  entries.push(...entry("/designers", { changeFrequency: "daily", priority: 0.6 }), ...entry("/subscriptions", { changeFrequency: "monthly", priority: 0.3 }));
  for (let page = 1; page <= MAX_DESIGN_PAGES; page++) {
    const result = await getDesigns(defaultLocale, { page }, revalidate);
    if (!result.ok) throw new CatalogUnavailableError(result.error.kind);
    for (const design of result.data.items) entries.push(...entry(`/designs/${design.slug}`, { changeFrequency: "weekly", priority: 0.5 }));
    if (page >= result.data.meta.last_page) break;
  }
  for (let page = 1; page <= MAX_DESIGN_PAGES; page++) {
    const result = await getDesigners(defaultLocale, { page }, revalidate);
    if (!result.ok) throw new CatalogUnavailableError(result.error.kind);
    for (const designer of result.data.items) entries.push(...entry(`/designers/${designer.slug}`, { changeFrequency: "weekly", priority: 0.5 }));
    if (page >= result.data.meta.last_page) break;
  }

  return entries;
}
