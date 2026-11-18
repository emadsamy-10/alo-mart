// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveFilters } from "@/features/catalog/ActiveFilters";
import { CatalogNavigationProvider } from "@/features/catalog/CatalogNavigation";
import { CatalogSearch } from "@/features/catalog/CatalogSearch";
import { FilterPanel, type FilterPanelData } from "@/features/catalog/FilterPanel";
import { parseCatalogParams, type CatalogState } from "@/features/catalog/filters";
import { groupDigits, sliderDomain, sliderStep } from "@/features/catalog/PriceRangeFilter";
import { SortSheet } from "@/features/catalog/SortControl";
import { initialSelection } from "@/features/products/variants";
import en from "../../messages/en.json";

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", async () => {
  const { forwardRef } = await import("react");
  return {
    useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
    Link: forwardRef<HTMLAnchorElement, { href: string; scroll?: boolean; children: ReactNode }>(function Link({ href, scroll, children, ...rest }, ref) {
      void scroll;
      return (
        <a ref={ref} href={href} {...rest}>
          {children}
        </a>
      );
    }),
  };
});

beforeAll(() => {
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => push.mockReset());

const wrap = (state: CatalogState, ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <CatalogNavigationProvider state={state}>{ui}</CatalogNavigationProvider>
  </NextIntlClientProvider>
);

const panel: FilterPanelData = {
  categories: [
    {
      id: 1,
      slug: "electronics",
      name: "Electronics",
      count: 0,
      children: [
        { id: 2, slug: "phones", name: "Phones", count: 3, children: [] },
        { id: 3, slug: "laptops", name: "Laptops", count: 2, children: [] },
        { id: 4, slug: "cameras", name: "Cameras", count: 0, children: [] },
      ],
    },
  ],
  brands: [
    { slug: "nordica", name: "Nordica", count: 4 },
    { slug: "kairo", name: "Kairo", count: 1 },
  ],
  stores: [],
  attributes: [
    {
      code: "color",
      name: "Color",
      swatches: true,
      values: [
        { code: "black", name: "Black", count: 3, swatch: "#1F1F1F" },
        { code: "white", name: "White", count: 2, swatch: "#F5F5F2" },
      ],
    },
  ],
  price: { min: "275.0000", max: "64999.0000" },
  currency: { code: "EGP", decimal_places: 2 },
  currencyLabel: "EGP",
};

const lastUrl = () => push.mock.calls.at(-1)?.[0] as string;

describe("slider helpers", () => {
  it("picks a 1-2-5 step from the span, never finer than the currency", () => {
    expect(sliderStep(64724, 2)).toBe(500);
    expect(sliderStep(90, 2)).toBe(1);
    expect(sliderStep(0.5, 2)).toBe(0.01);
    expect(sliderStep(0.5, 0)).toBe(1);
  });

  it("spans the facet bounds, widened to contain the shopper's own range", () => {
    expect(sliderDomain({ min: "275.5", max: "64999" }, { min: null, max: null })).toEqual({ lo: 275, hi: 64999 });
    // Older backends narrow the bounds to the selection; the selection must still fit on the track.
    expect(sliderDomain({ min: "1150", max: "4350" }, { min: "1000", max: "5000" })).toEqual({ lo: 1000, hi: 5000 });
    expect(sliderDomain({ min: null, max: null }, { min: "1", max: "2" })).toBeNull();
    expect(sliderDomain({ min: "10", max: "10" }, { min: null, max: null })).toBeNull();
  });
});

describe("price box display", () => {
  it("groups digits for reading without changing the exact value", () => {
    expect(groupDigits("1250000.75")).toBe("1,250,000.75");
    expect(groupDigits("999")).toBe("999");
    expect(groupDigits("12,500.5")).toBe("12,500.5");
    expect(groupDigits("abc")).toBe("abc");
  });
});

describe("product page preselection", () => {
  const variants = [
    { id: 1, price: "10", sale_price: null, is_in_stock: false, options: [{ attribute: { id: 9, name: "C", code: "c", input_type: "select" }, value: { id: 90, name: "Red", code: "red", display_value: null } }] },
    { id: 2, price: "10", sale_price: null, is_in_stock: true, options: [{ attribute: { id: 9, name: "C", code: "c", input_type: "select" }, value: { id: 91, name: "Blue", code: "blue", display_value: null } }] },
  ];

  it("opens on the matched variant when it belongs to the product, even if out of stock", () => {
    expect(initialSelection(variants, 1)).toEqual({ 9: 90 });
  });

  it("ignores an unknown id and falls back to the first in-stock variant", () => {
    expect(initialSelection(variants, 999)).toEqual({ 9: 91 });
    expect(initialSelection(variants)).toEqual({ 9: 91 });
  });
});

describe("FilterPanel", () => {
  it("multi-selects brands with OR semantics and returns to page 1", () => {
    render(wrap(parseCatalogParams({ brand: "nordica", page: "3" }), <FilterPanel data={panel} idPrefix="t" />));
    fireEvent.click(within(screen.getByTestId("filter-brand-kairo")).getByRole("checkbox"));
    expect(lastUrl()).toBe("/products?brand=kairo&brand=nordica");
  });

  it("selecting a parent category includes its sub-categories explicitly, and its count is the subtree's", () => {
    render(wrap(parseCatalogParams({}), <FilterPanel data={panel} idPrefix="t" />));
    const row = screen.getByTestId("filter-category-electronics");
    expect(row).toHaveTextContent("5");
    fireEvent.click(within(row).getByRole("checkbox"));
    expect(lastUrl()).toBe("/products?category=electronics&descendants=1");
  });

  it("a leaf category adds no descendants parameter (it has nothing to include)", () => {
    render(wrap(parseCatalogParams({}), <FilterPanel data={panel} idPrefix="t" />));
    fireEvent.click(screen.getByRole("button", { name: "Show sub-categories of Electronics" }));
    fireEvent.click(within(screen.getByTestId("filter-category-laptops")).getByRole("checkbox"));
    expect(lastUrl()).toBe("/products?category=laptops");
  });

  it("hides categories with no products and shows own counts when sub-categories are excluded", () => {
    render(wrap(parseCatalogParams({ category: "electronics" }), <FilterPanel data={panel} idPrefix="t" />));
    expect(screen.queryByTestId("filter-category-cameras")).toBeNull();
    // Exact mode: a parent with no products of its own shows no count (never a misleading subtree total).
    expect(screen.getByTestId("filter-category-electronics").textContent).toBe("Electronics");
    expect(screen.getByTestId("filter-category-phones")).toHaveTextContent("3");
    fireEvent.click(screen.getByTestId("include-descendants"));
    expect(lastUrl()).toBe("/products?category=electronics&descendants=1");
  });

  it("toggles attribute values as attr.<code>", () => {
    render(wrap(parseCatalogParams({ category: "phones" }), <FilterPanel data={panel} idPrefix="t" />));
    fireEvent.click(within(screen.getByTestId("filter-attr-color-white")).getByRole("checkbox"));
    expect(lastUrl()).toBe("/products?category=phones&attr.color=white");
  });

  it("never rewrites a price box on focus, so select-and-replace keeps exactly what was typed", () => {
    render(wrap(parseCatalogParams({ max: "1000" }), <FilterPanel data={panel} idPrefix="t" />));
    const to = within(screen.getByTestId("price-filter")).getByLabelText("To");
    expect(to).toHaveValue("1,000");
    fireEvent.focus(to);
    expect(to).toHaveValue("1,000");
    fireEvent.change(to, { target: { value: "20000.50" } });
    fireEvent.blur(to);
    expect(to).toHaveValue("20,000.5");
    fireEvent.submit(screen.getByTestId("price-filter"));
    expect(lastUrl()).toBe("/products?max=20000.5");
  });

  it("applies stock and sale filters", () => {
    render(wrap(parseCatalogParams({}), <FilterPanel data={panel} idPrefix="t" />));
    fireEvent.click(within(screen.getByTestId("filter-in-stock")).getByRole("switch"));
    expect(lastUrl()).toBe("/products?in_stock=1");
    fireEvent.click(within(screen.getByTestId("filter-on-sale")).getByRole("switch"));
    expect(lastUrl()).toBe("/products?on_sale=1");
  });

  it("validates and applies a typed price range, keeping exact decimals", () => {
    render(wrap(parseCatalogParams({ sort: "price_asc" }), <FilterPanel data={panel} idPrefix="t" />));
    const form = screen.getByTestId("price-filter");
    fireEvent.change(within(form).getByLabelText("From"), { target: { value: "5000" } });
    fireEvent.change(within(form).getByLabelText("To"), { target: { value: "1000" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("can’t be higher");
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(within(form).getByLabelText("To"), { target: { value: "12,500.75" } });
    fireEvent.submit(form);
    expect(lastUrl()).toBe("/products?min=5000&max=12500.75&sort=price_asc");
  });
});

describe("ActiveFilters", () => {
  const labels = {
    categories: { phones: "Phones" },
    brands: { nordica: "Nordica" },
    stores: {},
    attributes: { color: { name: "Color", values: { black: "Black" } } },
  };

  it("lists each choice as a link to the state without it, plus Clear all that keeps the search", () => {
    render(
      wrap(
        parseCatalogParams({ q: "aero", category: "phones", "attr.color": "black", brand: "nordica", min: "100", utm_source: "x" }),
        <ActiveFilters labels={labels} currency={{ code: "EGP", decimal_places: 2 }} />,
      ),
    );
    const chips = screen.getAllByTestId("filter-chip");
    expect(chips.map((c) => c.textContent?.replace(/[⁨⁩]/g, "").replace(/\s+/g, " "))).toEqual(["“aero”", "Phones", "From EGP 100", "Color: Black", "Nordica"]);
    expect(chips[3]).toHaveAttribute("href", "/products?q=aero&category=phones&brand=nordica&min=100&utm_source=x");
    // Removing the only category also removes the attribute that depended on it.
    expect(chips[1]).toHaveAttribute("href", "/products?q=aero&brand=nordica&min=100&utm_source=x");
    expect(screen.getByTestId("clear-all")).toHaveAttribute("href", "/products?q=aero&utm_source=x");
    fireEvent.click(chips[4]);
    expect(lastUrl()).toBe("/products?q=aero&category=phones&min=100&attr.color=black&utm_source=x");
  });
});

describe("CatalogSearch", () => {
  it("submits on Enter, keeps the filters, and enforces the 2-character minimum", () => {
    render(wrap(parseCatalogParams({ category: "phones", page: "4" }), <CatalogSearch />));
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: " a " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("alert")).toHaveTextContent("at least 2");
    expect(push).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  كرسي  مكتب " } });
    fireEvent.submit(screen.getByRole("search"));
    expect(decodeURIComponent(lastUrl())).toBe("/products?q=كرسي+مكتب&category=phones");
  });
});

describe("SortSheet labels", () => {
  const options = () => screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent);

  it("offers Best match only when the API ranks the search", () => {
    render(wrap(parseCatalogParams({ q: "chair" }), <SortSheet />));
    fireEvent.click(screen.getByTestId("open-sort"));
    expect(options()[0]).toBe("Best match");
    expect(options()).toContain("Newest first");
  });

  it("labels a newest-first fallback search honestly", () => {
    render(wrap(parseCatalogParams({ q: "the chair" }), <SortSheet />));
    fireEvent.click(screen.getByTestId("open-sort"));
    expect(options()).not.toContain("Best match");
    expect(options()[0]).toBe("Newest first");
    expect(options().filter((o) => o === "Newest first")).toHaveLength(1);
  });
});
