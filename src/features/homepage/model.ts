import { z } from "zod";
import {
  brandCardSchema,
  categoryCardSchema,
  lenientArray,
  productCardSchema,
  type BrandCard,
  type CategoryCard,
  type ProductCard,
} from "@/lib/api/schemas";

/**
 * Homepage merchandising model. The Admin configures sections per market; the
 * API returns only enabled, publishable sections with their resolved items.
 * This module turns that payload into a typed list the SectionRenderer can
 * exhaustively switch over — without ever inventing content.
 */

type ContentKind = "product" | "category" | "brand";

/**
 * Every section type the storefront understands, with the kind of item it
 * holds. Types not listed here (future backend additions) are skipped safely.
 * `top_rated` is listed for completeness: the backend never publishes it
 * while no ratings source exists, and if it ever does we still render no
 * stars unless real rating data arrives.
 */
export const SECTION_TYPES = {
  best_sellers: "product",
  top_rated: "product",
  new_arrivals: "product",
  featured_products: "product",
  deals: "product",
  category_products: "product",
  brand_products: "product",
  featured_categories: "category",
  featured_brands: "brand",
} as const satisfies Record<string, ContentKind>;

export type SectionType = keyof typeof SECTION_TYPES;
export type SectionLayout = "carousel" | "grid" | "tiles";

const LAYOUTS: Record<ContentKind, readonly SectionLayout[]> = {
  product: ["carousel", "grid"],
  category: ["carousel", "grid", "tiles"],
  brand: ["carousel", "grid", "tiles"],
};
const DEFAULT_LAYOUT: Record<ContentKind, SectionLayout> = { product: "carousel", category: "tiles", brand: "carousel" };

export interface SectionTarget {
  kind: "category" | "brand";
  id: number;
  slug: string;
}

interface SectionBase {
  id: string;
  type: SectionType;
  title: string | null;
  subtitle: string | null;
  layout: SectionLayout;
  sortOrder: number;
  target: SectionTarget | null;
}

export type HomepageSection =
  | (SectionBase & { kind: "product"; items: ProductCard[] })
  | (SectionBase & { kind: "category"; items: CategoryCard[] })
  | (SectionBase & { kind: "brand"; items: BrandCard[] });

const rawSectionSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  type: z.string(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  layout: z.string().nullable().optional(),
  sort_order: z.number().default(0),
  target: z
    .object({ kind: z.enum(["category", "brand"]), id: z.number(), slug: z.string() })
    .nullable()
    .optional()
    .catch(null),
  items: z.array(z.unknown()).default([]),
});

export const homepagePayloadSchema = z.object({
  market: z.object({ id: z.number(), code: z.string() }),
  sections: lenientArray(rawSectionSchema),
});
export type HomepagePayload = z.output<typeof homepagePayloadSchema>;

const itemParsers = {
  product: lenientArray(productCardSchema),
  category: lenientArray(categoryCardSchema),
  brand: lenientArray(brandCardSchema),
};

function isSectionType(type: string): type is SectionType {
  return Object.hasOwn(SECTION_TYPES, type);
}

function clean(text: string | null | undefined): string | null {
  const value = text?.trim();
  return value ? value : null;
}

/**
 * Map the API payload to renderable sections:
 *   - server order (sort_order, stable for ties),
 *   - unknown types skipped,
 *   - items validated per kind; invalid items dropped,
 *   - sections left with no items are omitted (nothing to show),
 *   - layout hints outside the kind's vocabulary fall back to a sane default.
 */
export function mapHomepageSections(sections: HomepagePayload["sections"]): HomepageSection[] {
  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => a.section.sort_order - b.section.sort_order || a.index - b.index)
    .flatMap(({ section }): HomepageSection[] => {
      if (!isSectionType(section.type)) return [];
      const kind = SECTION_TYPES[section.type];
      const layout = (LAYOUTS[kind] as readonly string[]).includes(section.layout ?? "")
        ? (section.layout as SectionLayout)
        : DEFAULT_LAYOUT[kind];

      const base: SectionBase = {
        id: section.id,
        type: section.type,
        title: clean(section.title),
        subtitle: clean(section.subtitle),
        layout,
        sortOrder: section.sort_order,
        target: section.target ?? null,
      };

      if (kind === "product") {
        const items = itemParsers.product.parse(section.items);
        return items.length ? [{ ...base, kind, items }] : [];
      }
      if (kind === "category") {
        const items = itemParsers.category.parse(section.items);
        return items.length ? [{ ...base, kind, items }] : [];
      }
      const items = itemParsers.brand.parse(section.items);
      return items.length ? [{ ...base, kind, items }] : [];
    });
}
