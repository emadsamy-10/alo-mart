/**
 * schema.org builders. Every field comes from real API data; anything we do
 * not know (ratings, reviews, GTIN, shipping, return policy) is omitted rather
 * than invented. Rich-result eligibility must still be validated with
 * Google's Rich Results Test before it is claimed.
 */

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(input: { siteUrl: string; name: string; logoUrl: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${input.siteUrl}/#organization`,
    name: input.name,
    url: input.siteUrl,
    logo: input.logoUrl,
  };
}

/** No SearchAction: the API has no text search yet, so we must not advertise one. */
export function websiteJsonLd(input: { siteUrl: string; name: string; url: string; locale: string }): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${input.siteUrl}/#website`,
    name: input.name,
    url: input.url,
    inLanguage: input.locale,
    publisher: { "@id": `${input.siteUrl}/#organization` },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export interface ProductJsonLdInput {
  url: string;
  name: string;
  description?: string | null;
  images: string[];
  sku?: string | null;
  brandName?: string | null;
  sellerName?: string | null;
  currency: string;
  /** Decimal strings straight from the API. */
  lowPrice: string;
  highPrice?: string | null;
  inStock: boolean;
}

function decimal(value: string): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : value;
}

export function productJsonLd(input: ProductJsonLdInput): JsonLd {
  const availability = input.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const seller = input.sellerName ? { "@type": "Organization", name: input.sellerName } : undefined;
  const ranged = input.highPrice && Number(input.highPrice) > Number(input.lowPrice);

  const offers = ranged
    ? {
        "@type": "AggregateOffer",
        priceCurrency: input.currency,
        lowPrice: decimal(input.lowPrice),
        highPrice: decimal(input.highPrice!),
        availability,
        url: input.url,
        ...(seller && { seller }),
      }
    : {
        "@type": "Offer",
        priceCurrency: input.currency,
        price: decimal(input.lowPrice),
        availability,
        url: input.url,
        itemCondition: "https://schema.org/NewCondition",
        ...(seller && { seller }),
      };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    url: input.url,
    ...(input.description && { description: input.description }),
    ...(input.images.length && { image: input.images }),
    ...(input.sku && { sku: input.sku }),
    ...(input.brandName && { brand: { "@type": "Brand", name: input.brandName } }),
    offers,
  };
}

/** Serialize for a <script type="application/ld+json"> without allowing `</script>` breakouts. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
