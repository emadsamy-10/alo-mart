/**
 * Shop (/products) URL state — the single, typed source of truth for the
 * catalog. Server page and client controls both read and write it through
 * this module, so no query string is ever assembled ad hoc.
 *
 *   ?q=<text>                     search (2–100 chars after trimming)
 *   ?category=<slug>  (repeat)    category_id[]  (OR)
 *   ?descendants=1                include_descendants (only with a category)
 *   ?brand=<slug>     (repeat)    brand_id[]     (OR)
 *   ?store=<slug>     (repeat)    store_id[]     (OR)
 *   ?min=<decimal>&max=<decimal>  min_price / max_price (selling price)
 *   ?in_stock=1  ?on_sale=1       in_stock / on_sale
 *   ?attr.<code>=<v1>,<v2>        attr[<code>]=v1,v2 (OR; needs a category)
 *   ?sort=<key>                   explicit sort (absent = newest, or relevance with q)
 *   ?page=<n>
 *
 * Slugs and codes keep URLs readable and stable; the server resolves them to
 * API ids. Malformed values are dropped, unknown keys are carried through
 * untouched (`extra`), and serialization uses one canonical key order so
 * equivalent states produce identical URLs.
 */

export const SORTS = ["newest", "price_asc", "price_desc", "name_asc", "name_desc", "best_selling"] as const;
export type SortKey = (typeof SORTS)[number];

/** Backend limits (docs/catalog-filtering-api.md §1). */
export const MAX_VALUES = 50;
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
export const MAX_PAGE = 9_999;

export interface CatalogState {
  q: string | null;
  categories: string[];
  descendants: boolean;
  brands: string[];
  stores: string[];
  /** Plain decimal strings exactly as the API accepts them (≤ 10 integer digits, ≤ 4 decimals). */
  min: string | null;
  max: string | null;
  inStock: boolean;
  onSale: boolean;
  /** attribute code → value codes (sorted, unique). */
  attrs: Record<string, string[]>;
  /** Only an explicit choice; null lets the API pick (newest, or relevance for a search). */
  sort: SortKey | null;
  page: number;
  /** Unrelated query parameters (utm_*, …), preserved in their original order. */
  extra: [string, string][];
}

export const EMPTY_STATE: CatalogState = {
  q: null,
  categories: [],
  descendants: false,
  brands: [],
  stores: [],
  min: null,
  max: null,
  inStock: false,
  onSale: false,
  attrs: {},
  sort: null,
  page: 1,
  extra: [],
};

export type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/;
const CODE = /^[a-z0-9][a-z0-9_-]{0,99}$/;
export const MONEY = /^\d{1,10}(\.\d{1,4})?$/;
const ATTR_PREFIX = "attr.";
const KNOWN = new Set(["q", "category", "descendants", "brand", "store", "min", "max", "in_stock", "on_sale", "sort", "page"]);

function entries(params: RawParams): [string, string][] {
  if (params instanceof URLSearchParams) return [...params.entries()];
  return Object.entries(params).flatMap(([key, value]) =>
    value === undefined ? [] : Array.isArray(value) ? value.map((v) => [key, v] as [string, string]) : [[key, value] as [string, string]],
  );
}

/** Sorted, de-duplicated, validated, capped list. */
function list(values: string[], pattern: RegExp): string[] {
  const out = new Set<string>();
  for (const raw of values) {
    for (const part of raw.split(",")) {
      const v = part.trim().toLowerCase();
      if (v && pattern.test(v)) out.add(v);
    }
  }
  return [...out].sort().slice(0, MAX_VALUES);
}

function flag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/**
 * Normalizes a typed or URL price to the API's plain-decimal form, or null.
 * Accepts grouping separators and Arabic-Indic digits: "1,250.50" → "1250.5".
 */
export function normalizeMoney(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[٫]/g, ".")
    .replace(/[\s,٬]/g, "");
  if (!MONEY.test(v)) return null;
  const [int, frac] = v.split(".");
  const integer = int.replace(/^0+(?=\d)/, "");
  const fraction = (frac ?? "").replace(/0+$/, "");
  return fraction ? `${integer}.${fraction}` : integer;
}

/** Exact comparison of two normalized money strings (no float rounding). */
export function compareMoney(a: string, b: string): number {
  const [ai, af = ""] = a.split(".");
  const [bi, bf = ""] = b.split(".");
  if (ai.length !== bi.length) return ai.length < bi.length ? -1 : 1;
  if (ai !== bi) return ai < bi ? -1 : 1;
  const len = Math.max(af.length, bf.length);
  const x = af.padEnd(len, "0");
  const y = bf.padEnd(len, "0");
  return x === y ? 0 : x < y ? -1 : 1;
}

export function normalizeSearch(value: string | null | undefined): string | null {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v.length >= SEARCH_MIN && v.length <= SEARCH_MAX ? v : null;
}

/*
 * Whether the API orders a search by relevance. Mirrors the backend contract
 * (docs/catalog-filtering-api.md §4–5; CatalogSearch::normalize/tokens and
 * CatalogQuery::canUseFulltext): operators become spaces, Arabic text is
 * normalized, and only when EVERY token is ≥ 3 characters, letters/digits only
 * and not a stopword does the FULLTEXT path (with a relevance score) run.
 * Otherwise the API uses a substring match with no score, ordered newest
 * first. (A SQLite backend — local development only — never uses FULLTEXT.)
 */
const SEARCH_OPERATORS = /[+\-*"()~<>@]/g;
const ARABIC_STRIP = /[ً-ٕـ]/g;
const ARABIC_FOLD: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي" };
const FULLTEXT_MIN_TOKEN = 3;
const FULLTEXT_STOPWORDS = new Set([
  "a", "about", "an", "are", "as", "at", "be", "by", "com", "de", "en", "for", "from", "how", "i", "in", "is", "it",
  "la", "of", "on", "or", "that", "the", "this", "to", "und", "was", "what", "when", "where", "who", "will", "with", "www",
]);

export function searchTokens(q: string): string[] {
  const padded = ` ${q.replace(SEARCH_OPERATORS, " ")}`
    .replace(/[\n\r\t\v\f]/g, " ")
    .replace(ARABIC_STRIP, "")
    .replace(/ٱ/g, "ا")
    .replaceAll(" ال", " ")
    .replace(/[أإآةىؤئ]/g, (c) => ARABIC_FOLD[c]);
  return padded.trim().split(/\s+/).filter(Boolean);
}

export function searchUsesRelevance(q: string | null): boolean {
  if (!q) return false;
  const tokens = searchTokens(q);
  return (
    tokens.length > 0 &&
    tokens.every((t) => [...t].length >= FULLTEXT_MIN_TOKEN && /^[\p{L}\p{N}]+$/u.test(t) && !FULLTEXT_STOPWORDS.has(t.toLowerCase()))
  );
}

export function parseCatalogParams(params: RawParams): CatalogState {
  const all = entries(params);
  const get = (key: string) => all.filter(([k]) => k === key).map(([, v]) => v);
  const first = (key: string) => get(key)[0];

  const attrs: Record<string, string[]> = {};
  for (const [key, value] of all) {
    if (!key.startsWith(ATTR_PREFIX)) continue;
    const code = key.slice(ATTR_PREFIX.length).toLowerCase();
    if (!CODE.test(code)) continue;
    const values = list([...(attrs[code] ?? []), value], CODE);
    if (values.length) attrs[code] = values;
  }

  let min = normalizeMoney(first("min"));
  let max = normalizeMoney(first("max"));
  if (min !== null && max !== null && compareMoney(min, max) > 0) [min, max] = [max, min];

  const sortValue = first("sort");
  const page = Number.parseInt(first("page") ?? "", 10);
  const categories = list(get("category"), SLUG);

  return {
    q: normalizeSearch(first("q")),
    categories,
    descendants: categories.length > 0 && flag(first("descendants")),
    brands: list(get("brand"), SLUG),
    stores: list(get("store"), SLUG),
    min,
    max,
    inStock: flag(first("in_stock")),
    onSale: flag(first("on_sale")),
    // The API rejects attribute filters without a category; never carry them alone.
    attrs: categories.length ? attrs : {},
    sort: (SORTS as readonly string[]).includes(sortValue ?? "") ? (sortValue as SortKey) : null,
    page: Number.isFinite(page) && page > 1 && page <= MAX_PAGE ? page : 1,
    extra: all.filter(([key]) => !KNOWN.has(key) && !key.startsWith(ATTR_PREFIX)),
  };
}

/** Canonical query pairs (repeat keys for lists). Page 1 and empty values are omitted. */
export function catalogSearchParams(state: CatalogState): URLSearchParams {
  const out = new URLSearchParams();
  if (state.q) out.append("q", state.q);
  for (const c of state.categories) out.append("category", c);
  if (state.descendants && state.categories.length) out.append("descendants", "1");
  for (const b of state.brands) out.append("brand", b);
  for (const s of state.stores) out.append("store", s);
  if (state.min !== null) out.append("min", state.min);
  if (state.max !== null) out.append("max", state.max);
  if (state.inStock) out.append("in_stock", "1");
  if (state.onSale) out.append("on_sale", "1");
  if (state.categories.length) {
    for (const code of Object.keys(state.attrs).sort()) {
      if (state.attrs[code].length) out.append(`${ATTR_PREFIX}${code}`, state.attrs[code].join(","));
    }
  }
  if (state.sort) out.append("sort", state.sort);
  if (state.page > 1) out.append("page", String(state.page));
  for (const [key, value] of state.extra) out.append(key, value);
  return out;
}

/** `/products?…` href for a state (the locale prefix is added by the i18n Link/router). */
export function catalogHref(state: CatalogState, path = "/products"): string {
  const qs = catalogSearchParams(state).toString();
  return qs ? `${path}?${qs}` : path;
}

/** Any narrowing filter (search and sort excluded). */
export function hasFilters(state: CatalogState): boolean {
  return (
    state.categories.length > 0 ||
    state.brands.length > 0 ||
    state.stores.length > 0 ||
    state.min !== null ||
    state.max !== null ||
    state.inStock ||
    state.onSale ||
    Object.keys(state.attrs).length > 0
  );
}

/** Index policy: only the plain listing (and its pages) is indexable. */
export function isFiltered(state: CatalogState): boolean {
  return hasFilters(state) || state.q !== null || state.sort !== null;
}

/** Number of active filter choices (badge on the mobile filter button). */
export function activeFilterCount(state: CatalogState): number {
  return (
    state.categories.length +
    state.brands.length +
    state.stores.length +
    (state.min !== null || state.max !== null ? 1 : 0) +
    (state.inStock ? 1 : 0) +
    (state.onSale ? 1 : 0) +
    Object.values(state.attrs).reduce((n, v) => n + v.length, 0)
  );
}

export type CatalogPatch = Partial<Omit<CatalogState, "extra">>;

/**
 * The state after a change. Every change except an explicit page returns to
 * page 1, so the shopper never lands on a page that no longer exists.
 */
export function withPatch(state: CatalogState, patch: CatalogPatch): CatalogState {
  const next: CatalogState = { ...state, ...patch, page: patch.page ?? 1 };
  // Unless the API ranks this search by relevance, "newest" IS the default order: keep one canonical URL for it.
  if (!searchUsesRelevance(next.q) && next.sort === "newest") next.sort = null;
  if (!next.categories.length) {
    next.descendants = false;
    next.attrs = {};
  }
  return next;
}

export function withPage(state: CatalogState, page: number): CatalogState {
  return { ...state, page: Math.min(MAX_PAGE, Math.max(1, Math.floor(page))) };
}

/** Adds or removes one value in a sorted list. */
export function toggled(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value].sort();
}

export function withAttr(state: CatalogState, code: string, value: string): CatalogState {
  const values = toggled(state.attrs[code] ?? [], value);
  const attrs = { ...state.attrs };
  if (values.length) attrs[code] = values;
  else delete attrs[code];
  return withPatch(state, { attrs });
}

/** Clear all FILTERS; the search term, an explicit sort and unrelated parameters stay. */
export function cleared(state: CatalogState): CatalogState {
  return { ...EMPTY_STATE, q: state.q, sort: state.sort, extra: state.extra };
}

/** Same filters regardless of page. */
export function sameFilters(a: CatalogState, b: CatalogState): boolean {
  return catalogSearchParams(withPage(a, 1)).toString() === catalogSearchParams(withPage(b, 1)).toString();
}
