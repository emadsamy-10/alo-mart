import type { FilterLabels } from "./ActiveFilters";
import type { FilterAttribute, FilterCategory, FilterOption, FilterPanelData } from "./FilterPanel";
import type { CatalogState } from "./filters";

/**
 * Pure assembly of the filter UI from the API's facets and taxonomy. Lives
 * apart from the page so it can be unit-tested against contract fixtures.
 */

interface TreeNode {
  id: number;
  slug: string;
  name: string;
  children: TreeNode[];
}

interface Ref {
  id: number;
  slug: string;
  name: string;
}

interface FacetsLike {
  price: { min: string | null; max: string | null };
  categories: { id: number; count: number }[];
  brands: (Ref & { count: number })[];
  stores: (Ref & { count: number })[];
  attributes: {
    code: string;
    name: string;
    input_type: string;
    values: { code: string; name: string; display_value: string | null; count: number }[];
  }[];
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function flattenTree<T extends { children: T[] }>(nodes: T[]): T[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

/**
 * Facet options, most products first (name breaks ties), plus any selected
 * slug the facet omitted (zero results under the other filters) so it can
 * still be removed.
 */
function withSelected(facet: (Ref & { count: number })[], selected: string[], all: Ref[]): FilterOption[] {
  const options: FilterOption[] = facet
    .map((f) => ({ slug: f.slug, name: f.name, count: f.count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  for (const slug of selected) {
    if (options.some((o) => o.slug === slug)) continue;
    const known = all.find((r) => r.slug === slug);
    if (known) options.push({ slug, name: known.name, count: 0 });
  }
  return options;
}

export function buildFilterPanel(input: {
  state: CatalogState;
  tree: TreeNode[];
  facets: FacetsLike | null;
  brands: Ref[];
  stores: Ref[];
  currency: { code: string; decimal_places: number };
  currencyLabel: string;
}): FilterPanelData {
  const { state, facets } = input;
  const counts = new Map((facets?.categories ?? []).map((c) => [c.id, c.count]));
  const categories = (nodes: TreeNode[]): FilterCategory[] =>
    nodes.map((n) => ({ id: n.id, slug: n.slug, name: n.name, count: counts.get(n.id) ?? 0, children: categories(n.children) }));

  const attributes: FilterAttribute[] = (facets?.attributes ?? []).map((a) => {
    const values = a.values.map((v) => ({
      code: v.code,
      name: v.name,
      count: v.count,
      swatch: a.input_type === "color" && v.display_value && HEX.test(v.display_value) ? v.display_value : null,
    }));
    for (const code of state.attrs[a.code] ?? []) {
      if (!values.some((v) => v.code === code)) values.push({ code, name: code, count: 0, swatch: null });
    }
    return { code: a.code, name: a.name, swatches: values.length > 0 && values.every((v) => v.swatch), values };
  });

  return {
    categories: facets ? categories(input.tree) : [],
    brands: facets ? withSelected(facets.brands, state.brands, input.brands) : [],
    stores: facets ? withSelected(facets.stores, state.stores, input.stores) : [],
    attributes,
    price: facets?.price ?? { min: null, max: null },
    currency: input.currency,
    currencyLabel: input.currencyLabel,
  };
}

export function buildFilterLabels(input: { tree: TreeNode[]; brands: Ref[]; stores: Ref[]; facets: FacetsLike | null }): FilterLabels {
  const byslug = (refs: Ref[]) => Object.fromEntries(refs.map((r) => [r.slug, r.name]));
  return {
    categories: byslug(flattenTree(input.tree)),
    brands: byslug(input.brands),
    stores: byslug(input.stores),
    attributes: Object.fromEntries(
      (input.facets?.attributes ?? []).map((a) => [a.code, { name: a.name, values: Object.fromEntries(a.values.map((v) => [v.code, v.name])) }]),
    ),
  };
}
