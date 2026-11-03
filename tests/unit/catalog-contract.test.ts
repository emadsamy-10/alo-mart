import { describe, expect, it, vi } from "vitest";
import { facetsQuery, listingQuery, rejectedAttributes } from "@/features/catalog/api-query";
import { EMPTY_STATE, parseCatalogParams } from "@/features/catalog/filters";
import { buildFilterLabels, buildFilterPanel } from "@/features/catalog/view-model";
import { priceViewFromCard } from "@/features/products/pricing";
import { productCardSchema } from "@/lib/api/schemas";
import facetsSmartphones from "./fixtures/facets-smartphones.json";
import error422 from "./fixtures/error-422-attr.json";
import listingMatched from "./fixtures/listing-matched.json";
import listingUnfiltered from "./fixtures/listing-unfiltered.json";

vi.mock("server-only", () => ({}));
const { buildApiUrl } = await import("@/lib/api/client");

/**
 * Contract tests: the requests we build follow docs/catalog-filtering-api.md
 * exactly, and the fixtures are REAL responses captured from the backend
 * (feature/catalog-filtering @ 2cc03b7, demo catalog, market EG).
 */
const ids = { categoryIds: [8, 4], brandIds: [3], storeIds: [] };

describe("API parameters", () => {
  const state = parseCatalogParams({
    q: "nordica",
    category: ["smartphones", "laptops"],
    descendants: "1",
    brand: "kairo-tech",
    min: "1000",
    max: "50000.5",
    in_stock: "1",
    on_sale: "1",
    "attr.storage": "512gb,256gb",
    "attr.color": "black",
    sort: "price_asc",
    page: "2",
  });

  it("encodes arrays as key[], booleans as 1 and attributes as attr[code]=v1,v2", () => {
    const url = new URL(buildApiUrl("products", listingQuery("EG", state, ids, 24)));
    expect(url.pathname.endsWith("/products")).toBe(true);
    expect([...url.searchParams.entries()]).toEqual([
      ["market", "EG"],
      ["q", "nordica"],
      ["category_id[]", "8"],
      ["category_id[]", "4"],
      ["include_descendants", "1"],
      ["attr[color]", "black"],
      ["attr[storage]", "256gb,512gb"],
      ["brand_id[]", "3"],
      ["min_price", "1000"],
      ["max_price", "50000.5"],
      ["in_stock", "1"],
      ["on_sale", "1"],
      ["sort", "price_asc"],
      ["page", "2"],
      ["per_page", "24"],
    ]);
  });

  it("asks facets for the same matching set, without sort or paging", () => {
    const facets = facetsQuery("EG", state, ids);
    expect(facets).not.toHaveProperty("sort");
    expect(facets).not.toHaveProperty("page");
    expect(facets).not.toHaveProperty("per_page");
    const { sort, page, per_page, ...listing } = listingQuery("EG", state, ids, 24);
    expect([sort, page, per_page]).toEqual(["price_asc", 2, 24]);
    expect(listing).toEqual(facets);
  });

  it("leaves the order to the API when no sort was chosen (newest, or relevance for a search)", () => {
    expect(listingQuery("EG", { ...EMPTY_STATE, q: "chair" }, { categoryIds: [], brandIds: [], storeIds: [] }, 24)).not.toHaveProperty("sort");
  });

  it("never sends include_descendants or attributes without a resolved category", () => {
    const query = facetsQuery("EG", { ...state }, { categoryIds: [], brandIds: [], storeIds: [] });
    expect(query).not.toHaveProperty("include_descendants");
    expect(Object.keys(query).some((k) => k.startsWith("attr["))).toBe(false);
  });

  it("finds the attribute codes a 422 rejected", () => {
    expect(error422.status).toBe(false);
    expect(rejectedAttributes(error422.errors)).toEqual(["nope"]);
    expect(rejectedAttributes({ max_price: ["…"] })).toEqual([]);
  });
});

describe("matched_variant pricing (real filtered response)", () => {
  // storage=512gb on smartphones matches the Vista 12 Pro 512 GB variant: 39,999 on sale at 37,499,
  // while the PRODUCT's cheapest variant (a 256 GB one) sells at 34,999.
  const [card] = listingMatched.data.items.map((i) => productCardSchema.parse(i));

  it("parses the conditional object", () => {
    expect(card.matched_variant).toMatchObject({ selling_price: "37499.0000", price: "39999.0000", is_in_stock: true });
    expect(card.price_from).toBe("34999.0000");
  });

  it("shows the matched variant's price, never the cheaper variant that did not match", () => {
    expect(priceViewFromCard(card)).toEqual({
      currency: card.currency,
      amount: "37499.0000",
      maxAmount: null,
      regularAmount: "39999.0000",
      discountPercent: 6,
      matched: true,
    });
  });

  it("keeps the product-wide price when the key is absent", () => {
    const cards = listingUnfiltered.data.items.map((i) => productCardSchema.parse(i));
    expect(cards.every((c) => c.matched_variant === undefined || c.matched_variant === null)).toBe(true);
    const vista = cards.find((c) => c.slug === "nordica-vista-12-pro-smartphone")!;
    expect(priceViewFromCard(vista)).toMatchObject({ amount: "34999.0000", maxAmount: "37499.0000", matched: false });
  });
});

describe("filter panel view model (real facets response)", () => {
  const facets = facetsSmartphones.data;
  const smartphonesId = facets.categories.find((c) => c.slug === "smartphones")!.id;
  const tree = [
    { id: 1, slug: "electronics", name: "Electronics", children: [{ id: smartphonesId, slug: "smartphones", name: "Smartphones", children: [] }] },
  ];
  const brands = [
    { id: 3, slug: "nordica", name: "Nordica" },
    { id: 9, slug: "lotus-botanics", name: "Lotus Botanics" },
  ];
  const state = parseCatalogParams({ category: "smartphones", brand: ["nordica", "lotus-botanics"], "attr.color": "black" });
  const panel = buildFilterPanel({ state, tree, facets, brands, stores: [], currency: { code: "EGP", decimal_places: 2 }, currencyLabel: "EGP" });

  it("renders a colour attribute with valid hex values as swatches and others as a list", () => {
    const color = panel.attributes.find((a) => a.code === "color")!;
    const storage = panel.attributes.find((a) => a.code === "storage")!;
    expect(color.swatches).toBe(true);
    expect(color.values.every((v) => /^#/.test(v.swatch ?? ""))).toBe(true);
    expect(storage.swatches).toBe(false);
    expect(storage.values.map((v) => v.code)).toEqual(facets.attributes.find((a) => a.code === "storage")!.values.map((v) => v.code));
  });

  it("keeps a selected option the facets omitted (zero results), so it can still be removed", () => {
    const lotus = panel.brands.find((b) => b.slug === "lotus-botanics");
    expect(facets.brands.some((b) => b.slug === "lotus-botanics")).toBe(false);
    expect(lotus).toEqual({ slug: "lotus-botanics", name: "Lotus Botanics", count: 0 });
  });

  it("takes category counts from the facets, by id", () => {
    const own = facets.categories.find((c) => c.slug === "smartphones")!.count;
    expect(panel.categories[0].children[0].count).toBe(own);
  });

  it("uses the facet price bounds as the slider's outer limits", () => {
    expect(panel.price).toEqual(facets.price);
  });

  it("names chips from the taxonomy and the facets", () => {
    const labels = buildFilterLabels({ tree, brands, stores: [], facets });
    expect(labels.categories.smartphones).toBe("Smartphones");
    expect(labels.attributes.color.values.black).toBe("Black");
  });
});
