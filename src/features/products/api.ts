import "server-only";
import { cache } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api/client";
import {
  currencySchema,
  decimalSchema,
  lenientArray,
  marketRefSchema,
  paginationMetaSchema,
  productCardSchema,
  responsiveImageSchema,
  slugRefSchema,
  categoryRefSchema,
} from "@/lib/api/schemas";

/** Prices & stock move: keep product data fresh (30s) rather than long-lived. */
const PRODUCT_REVALIDATE = 30;

const productListSchema = z.object({
  items: lenientArray(productCardSchema),
  meta: paginationMetaSchema,
});
export type ProductList = z.output<typeof productListSchema>;

export interface ProductListFilters {
  categoryId?: number;
  brandId?: number;
  storeId?: number;
  page?: number;
  perPage?: number;
}

/**
 * GET /products — newest first. NOTE: the API filters by EXACT category_id
 * (no descendants), so a parent category lists only products assigned to it
 * directly. Callers must present that honestly.
 */
export const getProducts = cache(async (locale: string, market: string, filters: ProductListFilters) =>
  apiGet("products", productListSchema, {
    locale,
    query: {
      market,
      category_id: filters.categoryId,
      brand_id: filters.brandId,
      store_id: filters.storeId,
      page: filters.page,
      per_page: filters.perPage ?? 24,
    },
    revalidate: PRODUCT_REVALIDATE,
    tags: ["products"],
  }),
);

const mediaSchema = responsiveImageSchema.extend({
  id: z.number(),
  type: z.string(),
  url: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  is_primary: z.boolean().default(false),
});
export type ProductMedia = z.output<typeof mediaSchema>;

const attributeSchema = z.object({
  attribute: z.object({ id: z.number(), name: z.string(), code: z.string() }).nullable(),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.object({ name: z.string().nullable().optional(), display_value: z.string().nullable().optional() }),
    z.null(),
  ]),
});

/** One option of a variant, e.g. Color = Black (#1F1F1F) or Storage = 256 GB. */
const variantOptionSchema = z.object({
  attribute: z.object({ id: z.number(), name: z.string(), code: z.string(), input_type: z.string().default("select") }),
  value: z.object({
    id: z.number(),
    name: z.string(),
    code: z.string(),
    /** Swatch value for color attributes (e.g. "#1F1F1F"); null otherwise. */
    display_value: z.string().nullable().optional().transform((v) => v ?? null),
  }),
});
export type VariantOption = z.output<typeof variantOptionSchema>;

const variantSchema = z.object({
  id: z.number(),
  sku: z.string().nullable().optional(),
  options: lenientArray(variantOptionSchema).optional().default([]),
  price: decimalSchema.nullable(),
  sale_price: decimalSchema.nullable(),
  is_in_stock: z.boolean(),
  media: lenientArray(mediaSchema).optional().default([]),
});
export type ProductVariant = z.output<typeof variantSchema>;

const productDetailSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  meta_title: z.string().nullable().optional(),
  meta_description: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  category: categoryRefSchema.nullable().optional().catch(null),
  brand: slugRefSchema.extend({ logo: z.string().nullable().optional() }).nullable().optional().catch(null),
  store: slugRefSchema.extend({ logo: z.string().nullable().optional(), description: z.string().nullable().optional() }).nullable().optional().catch(null),
  market: marketRefSchema,
  currency: currencySchema,
  attributes: lenientArray(attributeSchema).optional().default([]),
  media: lenientArray(mediaSchema).optional().default([]),
  variants: lenientArray(variantSchema).optional().default([]),
  price_from: decimalSchema.nullable(),
  price_to: decimalSchema.nullable(),
  has_price_range: z.boolean().default(false),
  is_in_stock: z.boolean(),
});
export type ProductDetail = z.output<typeof productDetailSchema>;

/** GET /products/{slug}?market= — 404 when unpublished/unavailable in the market. */
export const getProduct = cache(async (locale: string, market: string, slug: string) =>
  apiGet(`products/${encodeURIComponent(slug)}`, productDetailSchema, {
    locale,
    query: { market },
    revalidate: PRODUCT_REVALIDATE,
    tags: ["products", `product:${slug}`],
  }),
);
