import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/shared/Pagination";
import {
  EMPTY_STATE,
  activeFilterCount,
  catalogHref,
  catalogSearchParams,
  cleared,
  compareMoney,
  isFiltered,
  normalizeMoney,
  normalizeSearch,
  parseCatalogParams,
  sameFilters,
  searchTokens,
  searchUsesRelevance,
  toggled,
  withAttr,
  withPage,
  withPatch,
} from "@/features/catalog/filters";

const qs = (params: Record<string, string | string[]>) => parseCatalogParams(params);

describe("parseCatalogParams", () => {
  it("reads every filter, with repeated keys as lists", () => {
    const state = qs({
      q: "  modern   chair ",
      category: ["sofas", "beds"],
      descendants: "1",
      brand: ["nilewood", "kairo-tech"],
      store: "volta",
      min: "1000",
      max: "5000.50",
      in_stock: "1",
      on_sale: "1",
      "attr.color": "black,white",
      "attr.storage": "256gb",
      sort: "price_asc",
      page: "3",
    });
    expect(state).toEqual({
      q: "modern chair",
      categories: ["beds", "sofas"],
      descendants: true,
      brands: ["kairo-tech", "nilewood"],
      stores: ["volta"],
      min: "1000",
      max: "5000.5",
      inStock: true,
      onSale: true,
      attrs: { color: ["black", "white"], storage: ["256gb"] },
      sort: "price_asc",
      page: 3,
      extra: [],
    });
  });

  it("keeps the legacy single-value URLs working (?category=&brand=&store=)", () => {
    expect(qs({ category: "electronics", brand: "kairo-tech", store: "volta-electronics" })).toMatchObject({
      categories: ["electronics"],
      brands: ["kairo-tech"],
      stores: ["volta-electronics"],
      descendants: false,
    });
  });

  it("drops malformed values, an unknown sort and out-of-range pages", () => {
    const state = qs({ category: "../etc", brand: "", page: "-2", sort: "cheapest", min: "1e5", max: "-3", in_stock: "yes", q: "a" });
    expect(state).toEqual(EMPTY_STATE);
    expect(qs({ page: "abc" }).page).toBe(1);
    expect(qs({ page: "99999" }).page).toBe(1);
  });

  it("never carries attributes or descendants without a category (the API would 422)", () => {
    expect(qs({ "attr.color": "black", descendants: "1" })).toMatchObject({ attrs: {}, descendants: false });
  });

  it("merges and de-duplicates repeated attribute keys, ignoring bad codes", () => {
    expect(qs({ category: "phones", "attr.color": ["Black", "white,black"], "attr.Bad Code": "x" }).attrs).toEqual({ color: ["black", "white"] });
  });

  it("swaps an inverted price range instead of sending an invalid one", () => {
    expect(qs({ min: "900", max: "100" })).toMatchObject({ min: "100", max: "900" });
  });

  it("preserves unrelated parameters in their order", () => {
    expect(qs({ utm_source: "mail", category: "sofas", utm_campaign: "x" }).extra).toEqual([
      ["utm_source", "mail"],
      ["utm_campaign", "x"],
    ]);
  });

  it("reads URLSearchParams the same as Next's searchParams object", () => {
    const params = new URLSearchParams("category=beds&category=sofas&attr.size=l&q=sofa");
    expect(parseCatalogParams(params)).toEqual(qs({ category: ["beds", "sofas"], "attr.size": "l", q: "sofa" }));
  });
});

describe("money and search normalization", () => {
  it("normalizes typed prices exactly, including Arabic digits and grouping", () => {
    expect(normalizeMoney("1,250.50")).toBe("1250.5");
    expect(normalizeMoney("٢٥٠٠٫٧٥")).toBe("2500.75");
    expect(normalizeMoney("007")).toBe("7");
    expect(normalizeMoney("12.0000")).toBe("12");
    expect(normalizeMoney("12.34567")).toBeNull();
    expect(normalizeMoney("12345678901")).toBeNull();
    expect(normalizeMoney("-5")).toBeNull();
    expect(normalizeMoney(".5")).toBeNull();
  });

  it("compares decimals without float rounding", () => {
    expect(compareMoney("9999999999.9999", "9999999999.9998")).toBe(1);
    expect(compareMoney("100", "100.0")).toBe(0);
    expect(compareMoney("99.99", "100")).toBe(-1);
  });

  it("applies the API's 2–100 character search rule after trimming", () => {
    expect(normalizeSearch(" a ")).toBeNull();
    expect(normalizeSearch("رف")).toBe("رف");
    expect(normalizeSearch("x".repeat(101))).toBeNull();
  });
});

describe("serialization", () => {
  const state = qs({
    sort: "price_desc",
    "attr.storage": "256gb",
    "attr.color": "white,black",
    brand: ["b2", "b1"],
    category: "phones",
    q: "nordica",
    page: "2",
    utm_source: "x",
  });

  it("uses one canonical key order, so equivalent URLs are identical", () => {
    expect(catalogSearchParams(state).toString()).toBe(
      "q=nordica&category=phones&brand=b1&brand=b2&attr.color=black%2Cwhite&attr.storage=256gb&sort=price_desc&page=2&utm_source=x",
    );
  });

  it("round-trips through the parser", () => {
    expect(parseCatalogParams(catalogSearchParams(state))).toEqual(state);
  });

  it("omits page 1 and empty values", () => {
    expect(catalogHref(EMPTY_STATE)).toBe("/products");
    expect(catalogHref(withPage(state, 1))).not.toContain("page=");
  });
});

describe("state transitions", () => {
  const state = qs({ category: "phones", descendants: "1", "attr.color": "black", brand: "b1", q: "aero", sort: "newest", page: "4", utm_source: "x" });

  it("returns to page 1 on any change but an explicit page", () => {
    expect(withPatch(state, { inStock: true }).page).toBe(1);
    expect(withPatch(state, { sort: "price_asc" }).page).toBe(1);
    expect(withPage(state, 7).page).toBe(7);
    expect(sameFilters(state, withPage(state, 9))).toBe(true);
  });

  it("drops an explicit newest sort once the search is gone (newest is then the default)", () => {
    expect(withPatch(state, { q: null }).sort).toBeNull();
    expect(withPatch(state, { inStock: true }).sort).toBe("newest");
  });

  it("drops attributes and descendants when the last category is removed", () => {
    expect(withPatch(state, { categories: [] })).toMatchObject({ attrs: {}, descendants: false });
  });

  it("toggles list values and attribute values", () => {
    expect(toggled(["a", "c"], "b")).toEqual(["a", "b", "c"]);
    expect(toggled(["a", "b"], "a")).toEqual(["b"]);
    expect(withAttr(state, "color", "white").attrs).toEqual({ color: ["black", "white"] });
    expect(withAttr(state, "color", "black").attrs).toEqual({});
  });

  it("Clear all removes filters but keeps the search, the sort and unrelated parameters", () => {
    expect(cleared(state)).toEqual({ ...EMPTY_STATE, q: "aero", sort: "newest", extra: [["utm_source", "x"]] });
  });

  it("knows which URLs are filtered (noindex) and counts active choices", () => {
    expect(isFiltered(EMPTY_STATE)).toBe(false);
    expect(isFiltered(withPage(EMPTY_STATE, 3))).toBe(false);
    expect(isFiltered({ ...EMPTY_STATE, sort: "price_asc" })).toBe(true);
    expect(isFiltered({ ...EMPTY_STATE, q: "sofa" })).toBe(true);
    expect(activeFilterCount(state)).toBe(3);
    expect(activeFilterCount({ ...EMPTY_STATE, min: "1", max: "9", inStock: true })).toBe(2);
  });
});

describe("pageWindow", () => {
  it("shows first, last and neighbours with gaps", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
    expect(pageWindow(10, 10)).toEqual([1, "gap", 9, 10]);
  });
});

describe("search ordering (mirrors docs/catalog-filtering-api.md §4–5)", () => {
  it("is relevance only when every token can use FULLTEXT", () => {
    for (const q of ["chair", "modern chair", "كرسي", "الكرسي", "كُرْسِي", "chair and"]) expect(searchUsesRelevance(q), q).toBe(true);
    // 2-char tokens, stopwords, punctuation and operator-split SKUs take the newest-first substring path.
    for (const q of ["رف", "PC", "the chair", "a.b", "SKU-5", "ال"]) expect(searchUsesRelevance(q), q).toBe(false);
    expect(searchUsesRelevance(null)).toBe(false);
  });

  it("normalizes like the backend before tokenizing", () => {
    expect(searchTokens("+الكرسي* \"مكتب\"")).toEqual(["كرسي", "مكتب"]);
    expect(searchTokens("أريكة إطار")).toEqual(["اريكه", "اطار"]);
  });

  it("drops a redundant explicit newest sort when the search has no relevance order", () => {
    expect(withPatch(EMPTY_STATE, { q: "the chair", sort: "newest" }).sort).toBeNull();
    expect(withPatch(EMPTY_STATE, { q: "chair", sort: "newest" }).sort).toBe("newest");
  });
});
