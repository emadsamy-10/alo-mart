import { z } from "zod";

/**
 * Boundary schemas for the public ALO MART API, written against the REAL
 * responses (see docs/api-contract.md). Unknown extra fields are stripped,
 * optional/nullable fields stay optional, and lists are parsed item-by-item
 * so one malformed record drops that record — not the whole page.
 */

/** Parses each element independently, keeping only valid ones. */
export function lenientArray<T extends z.ZodType>(item: T) {
  return z.array(z.unknown()).transform((values) =>
    values.flatMap((value) => {
      const parsed = item.safeParse(value);
      return parsed.success ? [parsed.data as z.output<T>] : [];
    }),
  );
}

/** API money values are decimal strings ("4350.0000"); numbers are tolerated. */
export const decimalSchema = z.union([z.string(), z.number()]).transform(String);

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);
const nullableUrl = nullableString;

export const slugRefSchema = z.object({
  id: z.number(),
  name: z.string().nullable().transform((v) => v ?? ""),
  slug: z.string(),
});
export type SlugRef = z.output<typeof slugRefSchema>;

export const currencySchema = z.object({
  code: z.string(),
  symbol: nullableString,
  decimal_places: z.number().int().min(0).max(4).default(2),
});
export type Currency = z.output<typeof currencySchema>;

export const marketRefSchema = z.object({ id: z.number(), code: z.string() });

/**
 * Optional responsive renditions (backend image-optimisation work). Not yet
 * served by staging; every field is optional so today's payload parses and
 * tomorrow's is used automatically.
 */
const renditionSchema = z.object({
  url: nullableUrl,
  width_px: z.number().nullable().optional(),
  height_px: z.number().nullable().optional(),
});
export type ImageRendition = z.output<typeof renditionSchema>;

export const responsiveImageSchema = z.object({
  alt_text: nullableString,
  width_px: z.number().nullable().optional(),
  height_px: z.number().nullable().optional(),
  renditions: z.record(z.string(), renditionSchema).nullable().optional(),
  srcset: nullableString,
});
export type ResponsiveImage = z.output<typeof responsiveImageSchema>;

export const categoryRefSchema = slugRefSchema.extend({
  path: lenientArray(slugRefSchema).optional().default([]),
});

export const productCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  primary_image_url: nullableUrl,
  primary_image: responsiveImageSchema.nullable().optional().catch(null),
  store: slugRefSchema.nullable().optional().catch(null),
  category: categoryRefSchema.nullable().optional().catch(null),
  brand: slugRefSchema.nullable().optional().catch(null),
  market: marketRefSchema,
  currency: currencySchema,
  price_from: decimalSchema.nullable(),
  price_to: decimalSchema.nullable(),
  has_price_range: z.boolean().default(false),
  published_at: nullableString,
  is_in_stock: z.boolean(),
  /** Only present on `deals` homepage sections — the real reduced price. */
  deal: z
    .object({
      regular_price: decimalSchema,
      sale_price: decimalSchema,
      discount_percent: z.number().nullable().optional(),
    })
    .nullable()
    .optional()
    .catch(null),
});
export type ProductCard = z.output<typeof productCardSchema>;

export const categoryCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  image_url: nullableUrl,
  level: z.number().optional(),
  has_children: z.boolean().optional(),
  path: lenientArray(slugRefSchema).optional().default([]),
});
export type CategoryCard = z.output<typeof categoryCardSchema>;

export const brandCardSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  logo_url: nullableUrl,
});
export type BrandCard = z.output<typeof brandCardSchema>;

export const paginationMetaSchema = z.object({
  current_page: z.number(),
  last_page: z.number(),
  per_page: z.number(),
  total: z.number(),
});
export type PaginationMeta = z.output<typeof paginationMetaSchema>;
