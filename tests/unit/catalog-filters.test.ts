import { describe, expect, it } from "vitest";
import { pageWindow } from "@/components/shared/Pagination";
import { EMPTY_STATE, catalogQuery, isFiltered, parseCatalogParams, sameFilters, withFilter, withPage } from "@/features/catalog/filters";

describe("parseCatalogParams", () => {
  it("reads category, brand, store and page", () => {
    expect(parseCatalogParams({ category: "electronics", brand: "kairo-tech", store: "volta-electronics", page: "3" })).toEqual({
      category: "electronics",
      brand: "kairo-tech",
      store: "volta-electronics",
      page: 3,
    });
  });

  it("drops malformed values and ignores unknown keys", () => {
    expect(parseCatalogParams({ category: "../etc", brand: "", page: "-2", utm_source: "x", sort: "price_asc" })).toEqual(EMPTY_STATE);
    expect(parseCatalogParams({ page: "abc" }).page).toBe(1);
    expect(parseCatalogParams({ page: "99999" }).page).toBe(1);
  });

  it("uses the first value of duplicated parameters and normalizes case", () => {
    expect(parseCatalogParams({ brand: ["Kairo-Tech", "other"] }).brand).toBe("kairo-tech");
  });
});

describe("URL building", () => {
  const state = { category: "laptops", brand: "kairo-tech", store: null, page: 4 };

  it("serializes in a fixed order without empty values or duplicates", () => {
    expect(catalogQuery(state)).toEqual({ category: "laptops", brand: "kairo-tech", page: "4" });
    expect(Object.keys(catalogQuery(state))).toEqual(["category", "brand", "page"]);
    expect(catalogQuery(EMPTY_STATE)).toEqual({});
  });

  it("returns to page 1 whenever a filter changes", () => {
    expect(withFilter(state, "brand", "nordica")).toMatchObject({ brand: "nordica", page: 1 });
    expect(withFilter(state, "category", null)).toMatchObject({ category: null, page: 1 });
  });

  it("keeps filters when paging", () => {
    expect(catalogQuery(withPage(state, 2))).toEqual({ category: "laptops", brand: "kairo-tech", page: "2" });
    expect(sameFilters(state, withPage(state, 9))).toBe(true);
  });

  it("knows when a URL is filtered (noindex policy)", () => {
    expect(isFiltered(EMPTY_STATE)).toBe(false);
    expect(isFiltered(withPage(EMPTY_STATE, 3))).toBe(false);
    expect(isFiltered({ ...EMPTY_STATE, store: "meko" })).toBe(true);
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
