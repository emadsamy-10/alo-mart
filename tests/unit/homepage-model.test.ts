import { describe, expect, it } from "vitest";
import { homepagePayloadSchema, mapHomepageSections } from "@/features/homepage/model";

const product = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  primary_image_url: `https://api.example.test/storage/products/${id}.webp`,
  store: { id: 1, name: "Store", slug: "store" },
  category: { id: 2, name: "Cat", slug: "cat", path: [{ id: 2, name: "Cat", slug: "cat" }] },
  brand: null,
  market: { id: 1, code: "EG" },
  currency: { code: "EGP", symbol: "ج.م", decimal_places: 2 },
  price_from: "100.0000",
  price_to: "100.0000",
  has_price_range: false,
  published_at: "2026-10-08T15:54:32.000000Z",
  is_in_stock: true,
  ...extra,
});

const section = (overrides: Record<string, unknown>) => ({
  id: crypto.randomUUID(),
  type: "new_arrivals",
  content_kind: "product",
  title: "Title",
  subtitle: null,
  layout: "carousel",
  sort_order: 1,
  target: null,
  items: [product(1)],
  ...overrides,
});

function map(sections: unknown[]) {
  return mapHomepageSections(homepagePayloadSchema.parse({ market: { id: 1, code: "EG" }, sections }).sections);
}

describe("mapHomepageSections", () => {
  it("preserves server sort order, stable for ties", () => {
    const result = map([
      section({ id: "c", sort_order: 3 }),
      section({ id: "a", sort_order: 1 }),
      section({ id: "b1", sort_order: 2 }),
      section({ id: "b2", sort_order: 2 }),
    ]);
    expect(result.map((s) => s.id)).toEqual(["a", "b1", "b2", "c"]);
  });

  it("supports several sections of the same type", () => {
    const result = map([
      section({ id: "x", type: "category_products", target: { kind: "category", id: 1, slug: "furniture" } }),
      section({ id: "y", type: "category_products", target: { kind: "category", id: 5, slug: "electronics" } }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[1].target?.slug).toBe("electronics");
  });

  it("skips unknown future section types safely", () => {
    const result = map([section({ id: "known" }), section({ id: "future", type: "video_banner" })]);
    expect(result.map((s) => s.id)).toEqual(["known"]);
  });

  it("omits sections that end up with no items", () => {
    expect(map([section({ items: [] })])).toHaveLength(0);
  });

  it("drops only the malformed item, not the section", () => {
    const result = map([section({ items: [product(1), { id: "bad" }, product(2)] })]);
    expect(result[0].items.map((i) => i.id)).toEqual([1, 2]);
  });

  it("maps categories and brands by section type", () => {
    const result = map([
      section({
        id: "cats",
        type: "featured_categories",
        layout: "tiles",
        items: [{ id: 5, name: "Electronics", slug: "electronics", image_url: null, level: 1, has_children: true, path: [] }],
      }),
      section({ id: "brands", type: "featured_brands", items: [{ id: 7, name: "Nilewood", slug: "nilewood", logo_url: null }] }),
    ]);
    expect(result.map((s) => s.kind)).toEqual(["category", "brand"]);
  });

  it("falls back to a valid layout for the content kind", () => {
    const [products] = map([section({ layout: "tiles" })]);
    expect(products.layout).toBe("carousel");
    const [cats] = map([
      section({ type: "featured_categories", layout: null, items: [{ id: 1, name: "A", slug: "a", image_url: null }] }),
    ]);
    expect(cats.layout).toBe("tiles");
  });

  it("normalizes blank titles to null (renderer supplies a translated fallback)", () => {
    expect(map([section({ title: "   " })])[0].title).toBeNull();
  });

  it("keeps the real deal on deal items", () => {
    const [deals] = map([
      section({ type: "deals", items: [product(9, { deal: { regular_price: "690.0000", sale_price: "590.0000", discount_percent: 14 } })] }),
    ]);
    expect(deals.kind === "product" && deals.items[0].deal?.discount_percent).toBe(14);
  });
});
