import type { CategoryNode } from "@/features/catalog/api";

/** Minimal category shape sent to client navigation islands (no meta fields). */
export interface NavCategory {
  name: string;
  slug: string;
  imageUrl: string | null;
  children: NavCategory[];
}

export function toNavCategories(nodes: CategoryNode[]): NavCategory[] {
  return nodes.map((node) => ({
    name: node.name,
    slug: node.slug,
    imageUrl: node.imageUrl,
    children: toNavCategories(node.children),
  }));
}
