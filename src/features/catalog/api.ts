import "server-only";
import { cache } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api/client";
import { lenientArray } from "@/lib/api/schemas";

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
