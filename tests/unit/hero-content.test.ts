import { describe, expect, it } from "vitest";
import { pickHeroContent } from "@/features/homepage/hero-content";
import { homepagePayloadSchema, mapHomepageSections } from "@/features/homepage/model";

const product = (id: number, w: number, h: number) => ({
  id,
  name: `Product ${id}`,
  slug: `product-${id}`,
  primary_image_url: `https://api.example.test/p/${id}.webp`,
  primary_image: {
    width_px: w,
    height_px: h,
    renditions: { large: { url: `https://api.example.test/p/${id}-large.webp`, width_px: w, height_px: h } },
  },
  market: { id: 1, code: "EG" },
  currency: { code: "EGP", symbol: "ج.م", decimal_places: 2 },
  price_from: "100.0000",
  price_to: "100.0000",
  has_price_range: false,
  is_in_stock: true,
});

const sections = (raw: unknown[]) =>
  mapHomepageSections(homepagePayloadSchema.parse({ market: { id: 1, code: "EG" }, sections: raw }).sections);

const departments = [
  { name: "Electronics", slug: "electronics", imageUrl: "https://api.example.test/c/5.jpg" },
  { name: "Furniture", slug: "furniture", imageUrl: "https://api.example.test/c/1.jpg" },
  { name: "Fashion", slug: "fashion", imageUrl: null },
];

describe("pickHeroContent", () => {
  it("features a landscape photo from the Admin's featured products, with the section title as eyebrow", () => {
    const content = pickHeroContent(
      sections([
        { id: "best", type: "new_arrivals", title: "New", sort_order: 1, items: [product(1, 1200, 800)] },
        { id: "feat", type: "featured_products", title: "Featured Products", sort_order: 2, items: [product(2, 800, 1200), product(3, 1200, 800)] },
      ]),
      departments,
    );
    expect(content.feature?.product.id).toBe(3);
    expect(content.feature?.image.src).toContain("3-large");
    expect(content.feature?.eyebrow).toBe("Featured Products");
  });

  it("uses Admin category sections for promos, named after the target department", () => {
    const content = pickHeroContent(
      sections([
        { id: "feat", type: "featured_products", sort_order: 1, items: [product(1, 1200, 800)] },
        { id: "furn", type: "category_products", title: "Best Sellers", sort_order: 2, target: { kind: "category", id: 1, slug: "furniture" }, items: [product(1, 1200, 800), product(4, 1200, 800)] },
      ]),
      departments,
    );
    expect(content.promos[0]).toMatchObject({ title: "Furniture", href: "/categories/furniture" });
    // The featured product is not reused in a promo.
    expect(content.promos[0].image.src).toContain("4-large");
  });

  it("tops promos up with departments that have their own image, skipping image-less ones", () => {
    const content = pickHeroContent(sections([{ id: "feat", type: "featured_products", sort_order: 1, items: [product(1, 1200, 800)] }]), departments);
    expect(content.promos.map((p) => p.href)).toEqual(["/categories/electronics", "/categories/furniture"]);
  });

  it("returns no feature when the market has no products (honest fallback)", () => {
    const content = pickHeroContent([], departments);
    expect(content.feature).toBeNull();
    expect(content.promos).toHaveLength(2);
  });
});
