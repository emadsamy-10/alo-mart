import "server-only";
import { cache } from "react";
import { z } from "zod";
import { apiGet, type QueryValue } from "@/lib/api/client";
import { decimalSchema, lenientArray, paginationMetaSchema, productCardSchema } from "@/lib/api/schemas";

export interface CategoryNode {
  id: number;
  name: string;
  slug: string;
  level: number;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  children: CategoryNode[];
}

const categoryNodeSchema: z.ZodType<CategoryNode> = z.lazy(() =>
  z
    .object({
      id: z.number(),
      name: z.string(),
      slug: z.string(),
      level: z.number().default(1),
      image_url: z.string().nullable().optional(),
      meta_title: z.string().nullable().optional(),
      meta_description: z.string().nullable().optional(),
      children: lenientArray(categoryNodeSchema).optional().default([]),
    })
    .transform((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      level: c.level,
      imageUrl: c.image_url ?? null,
      metaTitle: c.meta_title ?? null,
      metaDescription: c.meta_description ?? null,
      children: c.children,
    })),
);

/**
 * The public, market-effective category tree (3 levels). Used by the header
 * mega menu, the hero and category pages; cached for 10 minutes per
 * market + locale.
 */
export const getCategoryTree = cache(async (locale: string, market: string) =>
  apiGet("categories", lenientArray(categoryNodeSchema), {
    locale,
    query: { market },
    revalidate: 600,
    tags: ["categories"],
  }),
);

export interface CategoryLocation {
  node: CategoryNode;
  /** Root → node, inclusive. */
  trail: CategoryNode[];
}

/** Depth-first lookup of a slug in the tree, returning its breadcrumb trail. */
export function findCategory(tree: CategoryNode[], slug: string): CategoryLocation | null {
  for (const node of tree) {
    if (node.slug === slug) return { node, trail: [node] };
    const inChild = findCategory(node.children, slug);
    if (inChild) return { node: inChild.node, trail: [node, ...inChild.trail] };
  }
  return null;
}

const brandSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
});
export type BrandDetail = z.output<typeof brandSchema>;

export const getBrand = cache(async (locale: string, slug: string) =>
  apiGet(`brands/${encodeURIComponent(slug)}`, brandSchema, {
    locale,
    revalidate: 600,
    tags: ["brands"],
  }),
);

export const getBrands = cache(async (locale: string) =>
  apiGet("brands", lenientArray(brandSchema), { locale, revalidate: 600, tags: ["brands"] }),
);

const storeSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  logo: z.string().nullable().optional(),
});
export type StoreSummary = z.output<typeof storeSchema>;

/** Public stores (paginated by the API; 100 is the API's page-size cap). */
export const getStores = cache(async (locale: string) =>
  apiGet("stores", z.object({ items: lenientArray(storeSchema) }), {
    locale,
    query: { per_page: 100 },
    revalidate: 600,
    tags: ["stores"],
  }),
);

const storeDetailSchema = storeSchema.extend({
  description: z.string().nullable().optional().transform((v) => v ?? null),
  cover_image: z.string().nullable().optional().transform((v) => v ?? null),
  contact_email: z.string().nullable().optional().transform((v) => v ?? null),
  contact_phone: z.string().nullable().optional().transform((v) => v ?? null),
  website: z.string().nullable().optional().transform((v) => v ?? null),
  /** The merchant's own active policies (shipping, returns…), bilingual from the API. */
  policies: lenientArray(z.object({ code: z.string(), title: z.string().nullable(), content: z.string().nullable() }))
    .optional()
    .transform((v) => v ?? []),
});
export type StoreDetail = z.output<typeof storeDetailSchema>;

/** A public store (404 when the store isn't public). */
export const getStore = cache(async (locale: string, slug: string) =>
  apiGet(`stores/${encodeURIComponent(slug)}`, storeDetailSchema, { locale, revalidate: 600, tags: ["stores"] }),
);

// ── Advanced catalog: listing + facets (docs/catalog-filtering-api.md) ─────

/** Prices, stock and counts move: same freshness as the product list. */
const CATALOG_REVALIDATE = 30;

const catalogListingSchema = z.object({
  items: lenientArray(productCardSchema),
  meta: paginationMetaSchema,
});
export type CatalogListing = z.output<typeof catalogListingSchema>;

/** GET /products with the full filter set. `query` comes from listingQuery(). */
export const getCatalogListing = cache(async (locale: string, query: Record<string, QueryValue>) =>
  apiGet("products", catalogListingSchema, { locale, query, revalidate: CATALOG_REVALIDATE, tags: ["products"] }),
);

const countSchema = z.number().int().nonnegative();

const facetCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  parent_id: z.number().nullable().optional(),
  level: z.number().optional(),
  count: countSchema,
});

const facetRefSchema = z.object({ id: z.number(), name: z.string(), slug: z.string(), count: countSchema });

const facetValueSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  display_value: z.string().nullable().optional().transform((v) => v ?? null),
  count: countSchema,
});

const facetAttributeSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  input_type: z.string().default("select"),
  is_variant: z.boolean().optional(),
  values: lenientArray(facetValueSchema),
});
export type FacetAttribute = z.output<typeof facetAttributeSchema>;
export type FacetValue = z.output<typeof facetValueSchema>;

const facetsSchema = z.object({
  total: countSchema,
  price: z
    .object({ min: decimalSchema.nullable(), max: decimalSchema.nullable() })
    .nullable()
    .optional()
    .transform((p) => ({ min: p?.min ?? null, max: p?.max ?? null })),
  categories: lenientArray(facetCategorySchema).optional().default([]),
  brands: lenientArray(facetRefSchema).optional().default([]),
  stores: lenientArray(facetRefSchema).optional().default([]),
  attributes: lenientArray(facetAttributeSchema).optional().default([]),
});
export type CatalogFacets = z.output<typeof facetsSchema>;

/**
 * GET /products/facets — catalog-wide counts with drill-down self-exclusion,
 * and price bounds that (on the current backend) ignore the selected price
 * range. `query` comes from facetsQuery(); it never carries sort or paging.
 */
export const getCatalogFacets = cache(async (locale: string, query: Record<string, QueryValue>) =>
  apiGet("products/facets", facetsSchema, { locale, query, revalidate: CATALOG_REVALIDATE, tags: ["products"] }),
);
