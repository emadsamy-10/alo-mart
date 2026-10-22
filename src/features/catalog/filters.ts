/**
 * Shop (/products) URL state. Only filters the public API really applies to
 * the WHOLE eligible catalog are modelled (see docs/api-contract.md):
 *
 *   ?category=<slug>  → category_id (exact category, single)
 *   ?brand=<slug>     → brand_id    (single)
 *   ?store=<slug>     → store_id    (single)
 *   ?page=<n>         → page
 *
 * Slugs keep URLs readable and stable; they are resolved to API ids on the
 * server. Unknown keys are ignored; malformed values are dropped.
 */

export const FILTER_KEYS = ["category", "brand", "store"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

export interface CatalogState {
  category: string | null;
  brand: string | null;
  store: string | null;
  page: number;
}

export const EMPTY_STATE: CatalogState = { category: null, brand: null, store: null, page: 1 };

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/;
type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function slug(value: string | string[] | undefined): string | null {
  const v = first(value)?.trim().toLowerCase();
  return v && SLUG.test(v) ? v : null;
}

export function parseCatalogParams(params: RawParams): CatalogState {
  const page = Number.parseInt(first(params.page) ?? "", 10);
  return {
    category: slug(params.category),
    brand: slug(params.brand),
    store: slug(params.store),
    page: Number.isFinite(page) && page > 1 && page < 10_000 ? page : 1,
  };
}

export function isFiltered(state: CatalogState): boolean {
  return FILTER_KEYS.some((k) => state[k] !== null);
}

/** Query object for a state, in a fixed key order with empty values omitted (no duplicates). */
export function catalogQuery(state: CatalogState): Record<string, string> {
  const query: Record<string, string> = {};
  for (const key of FILTER_KEYS) if (state[key]) query[key] = state[key]!;
  if (state.page > 1) query.page = String(state.page);
  return query;
}

/**
 * The state after changing one filter. Any filter change returns to page 1,
 * so the shopper never lands on a page that no longer exists.
 */
export function withFilter(state: CatalogState, key: FilterKey, value: string | null): CatalogState {
  return { ...state, [key]: value, page: 1 };
}

export function withPage(state: CatalogState, page: number): CatalogState {
  return { ...state, page: Math.max(1, Math.floor(page)) };
}

export function cleared(): CatalogState {
  return { ...EMPTY_STATE };
}

/** Same filters, regardless of page. */
export function sameFilters(a: CatalogState, b: CatalogState): boolean {
  return FILTER_KEYS.every((k) => a[k] === b[k]);
}
