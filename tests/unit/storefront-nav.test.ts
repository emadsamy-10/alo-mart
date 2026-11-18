import { describe, expect, it } from "vitest";
import { categoryIcon } from "@/components/layout/category-icon";
import { activeNavKey, NAV_LINKS } from "@/components/layout/nav-links";
import { parseCatalogParams, SORTS } from "@/features/catalog/filters";
import { quickAddVariant, type VariantLike } from "@/features/products/variants";

const variant = (over: Partial<VariantLike> = {}): VariantLike => ({ id: 1, price: "100.0000", sale_price: null, is_in_stock: true, options: [], ...over });

describe("primary navigation", () => {
  it("lists every approved destination, All Products included", () => {
    expect(NAV_LINKS.map((l) => l.key)).toEqual(["home", "allProducts", "stores", "brands", "designers", "newArrivals", "bestSellers", "offers"]);
  });

  it("only links to catalog states the catalog really understands", () => {
    const params = (href: string) => Object.fromEntries(new URL(href, "http://x").searchParams);
    const state = (key: string) => parseCatalogParams(params(NAV_LINKS.find((l) => l.key === key)!.href));
    expect(SORTS).toContain(state("newArrivals").sort);
    expect(state("bestSellers").sort).toBe("best_selling");
    expect(state("offers").onSale).toBe(true);
  });

  it("marks one active entry from the path and query", () => {
    const none = { sort: null, onSale: null };
    expect(activeNavKey("/", none)).toBe("home");
    expect(activeNavKey("/products", none)).toBe("allProducts");
    expect(activeNavKey("/products", null)).toBe("allProducts");
    expect(activeNavKey("/products", { sort: "newest", onSale: null })).toBe("newArrivals");
    expect(activeNavKey("/products", { sort: "best_selling", onSale: null })).toBe("bestSellers");
    expect(activeNavKey("/products", { sort: "newest", onSale: "1" })).toBe("offers");
    expect(activeNavKey("/products", { sort: "price_asc", onSale: null })).toBe("allProducts");
    expect(activeNavKey("/stores/mada", none)).toBe("stores");
    expect(activeNavKey("/brands", none)).toBe("brands");
    expect(activeNavKey("/designers", none)).toBe("designers");
    expect(activeNavKey("/designers/nour-studio-ab12c", none)).toBe("designers");
    expect(activeNavKey("/designs/sunlit-room-ab12cd", none)).toBe("designers");
    expect(activeNavKey("/categories/fashion", none)).toBeNull();
  });

  it("gives an unknown department a neutral icon instead of failing", () => {
    expect(categoryIcon("electronics")).not.toBe(categoryIcon("unknown-department"));
    expect(categoryIcon("unknown-department")).toBeTruthy();
  });
});

describe("quick add from a card", () => {
  it("adds directly only the only, purchasable variant", () => {
    expect(quickAddVariant([variant()])?.id).toBe(1);
  });

  it("asks the shopper to choose when several variants exist", () => {
    expect(quickAddVariant([variant(), variant({ id: 2 })])).toBeNull();
  });

  it("never adds something that cannot be bought", () => {
    expect(quickAddVariant([])).toBeNull();
    expect(quickAddVariant([variant({ is_in_stock: false })])).toBeNull();
    expect(quickAddVariant([variant({ price: null })])).toBeNull();
  });
});
