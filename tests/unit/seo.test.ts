import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, productJsonLd, serializeJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { buildPageMetadata, languageAlternates, localizedUrl, truncateDescription } from "@/lib/seo/metadata";

const prod = { siteUrl: "https://www.example.com", indexable: true, siteName: "ALO MART" };
const staging = { ...prod, indexable: false };

describe("canonical & alternates", () => {
  it("builds locale-prefixed canonical URLs without trailing slash", () => {
    expect(localizedUrl(prod.siteUrl, "ar", "/")).toBe("https://www.example.com/ar");
    expect(localizedUrl(prod.siteUrl, "en", "/products/desk/")).toBe("https://www.example.com/en/products/desk");
  });

  it("self-canonicalizes paginated pages beyond page 1 only", () => {
    expect(localizedUrl(prod.siteUrl, "en", "/categories/x", 1)).toBe("https://www.example.com/en/categories/x");
    expect(localizedUrl(prod.siteUrl, "en", "/categories/x", 3)).toBe("https://www.example.com/en/categories/x?page=3");
  });

  it("lists every locale plus x-default (Arabic is the default locale)", () => {
    expect(languageAlternates(prod.siteUrl, "/")).toEqual({
      ar: "https://www.example.com/ar",
      en: "https://www.example.com/en",
      "x-default": "https://www.example.com/ar",
    });
  });
});

describe("buildPageMetadata", () => {
  const input = { locale: "en" as const, path: "/", title: "Home", description: "Desc" };

  it("is indexable in production", () => {
    const meta = buildPageMetadata(prod, input);
    expect(meta.robots).toMatchObject({ index: true, follow: true });
    expect(meta.alternates?.canonical).toBe("https://www.example.com/en");
    expect(meta.openGraph).toMatchObject({ url: "https://www.example.com/en", locale: "en_US" });
  });

  it("is never indexable on staging, whatever the page asks", () => {
    expect(buildPageMetadata(staging, input).robots).toMatchObject({ index: false, follow: false });
  });

  it("honours per-page noindex (thin pages) while still following links", () => {
    expect(buildPageMetadata(prod, { ...input, noindex: true }).robots).toMatchObject({ index: false, follow: true });
  });

  it("uses a large Twitter card only with an image", () => {
    expect(buildPageMetadata(prod, input).twitter).toMatchObject({ card: "summary" });
    expect(
      buildPageMetadata(prod, { ...input, image: { url: "https://cdn.example.com/a.webp" } }).twitter,
    ).toMatchObject({ card: "summary_large_image" });
  });
});

describe("truncateDescription", () => {
  it("collapses whitespace and cuts at a word boundary", () => {
    const text = "word ".repeat(60);
    const result = truncateDescription(text);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s{2,}/);
  });
  it("leaves short text alone", () => {
    expect(truncateDescription("  short   text ")).toBe("short text");
  });
});

describe("JSON-LD", () => {
  const base = {
    url: "https://www.example.com/en/products/desk",
    name: "Desk",
    images: ["https://api.example.com/desk.webp"],
    currency: "EGP",
    lowPrice: "4350.0000",
    inStock: true,
  };

  it("emits a single Offer with real price/availability and no ratings", () => {
    const data = productJsonLd({ ...base, brandName: "Oasis", sellerName: "Dar Al Bait" });
    expect(data.offers).toMatchObject({ "@type": "Offer", price: "4350.00", priceCurrency: "EGP", availability: "https://schema.org/InStock" });
    expect(data.brand).toEqual({ "@type": "Brand", name: "Oasis" });
    expect(data).not.toHaveProperty("aggregateRating");
    expect(data).not.toHaveProperty("review");
  });

  it("emits an AggregateOffer for real price ranges and omits unknown brand", () => {
    const data = productJsonLd({ ...base, highPrice: "5000.0000", inStock: false });
    expect(data.offers).toMatchObject({ "@type": "AggregateOffer", lowPrice: "4350.00", highPrice: "5000.00", availability: "https://schema.org/OutOfStock" });
    expect(data).not.toHaveProperty("brand");
  });

  it("builds ordered breadcrumbs", () => {
    const data = breadcrumbJsonLd([{ name: "Home", url: "u1" }, { name: "Desk", url: "u2" }]);
    expect((data.itemListElement as { position: number }[]).map((i) => i.position)).toEqual([1, 2]);
  });

  it("does not advertise a search action (no search API yet)", () => {
    expect(websiteJsonLd({ siteUrl: prod.siteUrl, name: "ALO MART", url: prod.siteUrl + "/en", locale: "en" })).not.toHaveProperty(
      "potentialAction",
    );
  });

  it("escapes </script> breakouts", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});
