import type { QueryValue } from "@/lib/api/client";
import type { CatalogState } from "./filters";

/** Ids the server resolved from the URL's slugs (unknown slugs are already dropped). */
export interface ResolvedIds {
  categoryIds: number[];
  brandIds: number[];
  storeIds: number[];
}

/**
 * The exact parameters of `GET /products/facets` (docs/catalog-filtering-api.md
 * §1): arrays as `key[]`, booleans only as `1`, attributes as
 * `attr[code]=v1,v2`, and `include_descendants` only with a category. The
 * listing adds sort and paging on top (see listingQuery), so both requests
 * always describe the same matching set.
 */
export function facetsQuery(market: string, state: CatalogState, ids: ResolvedIds): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = { market };
  if (state.q) query.q = state.q;
  if (ids.categoryIds.length) {
    query["category_id[]"] = ids.categoryIds;
    if (state.descendants) query.include_descendants = 1;
    for (const code of Object.keys(state.attrs).sort()) {
      if (state.attrs[code].length) query[`attr[${code}]`] = state.attrs[code].join(",");
    }
  }
  if (ids.brandIds.length) query["brand_id[]"] = ids.brandIds;
  if (ids.storeIds.length) query["store_id[]"] = ids.storeIds;
  if (state.min !== null) query.min_price = state.min;
  if (state.max !== null) query.max_price = state.max;
  if (state.inStock) query.in_stock = 1;
  if (state.onSale) query.on_sale = 1;
  return query;
}

export function listingQuery(market: string, state: CatalogState, ids: ResolvedIds, perPage: number): Record<string, QueryValue> {
  return {
    ...facetsQuery(market, state, ids),
    // No sort = the API's own default: newest, or relevance for a FULLTEXT search.
    ...(state.sort ? { sort: state.sort } : {}),
    page: state.page,
    per_page: perPage,
  };
}

/**
 * Attribute codes the API rejected (422 `attr.<code>`), e.g. after the
 * category changed and an old attribute no longer applies.
 */
export function rejectedAttributes(errors: Record<string, string[]> | undefined): string[] {
  return Object.keys(errors ?? {})
    .filter((key) => key.startsWith("attr."))
    .map((key) => key.slice("attr.".length));
}
