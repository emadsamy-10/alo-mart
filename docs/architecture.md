# Storefront architecture (Phase 1)

## Stack

Next.js 16.3.8 (App Router, Turbopack, React 19.2) · TypeScript strict · Tailwind CSS 4 ·
next-intl 4 · next-themes · Radix primitives (`radix-ui`) · lucide-react · zod (API boundary) ·
Vitest + Testing Library · Playwright. No client data-fetching library and no global store:
all catalog data is fetched on the server.

## Layout

```
src/
  app/                       routes (all under [locale]) + robots, sitemap, icons, 404/error
  components/
    layout/                  header, footer, mega menu, mobile drawer, switchers, providers
    shared/                  AppImage, Container, SectionHeading, Carousel, StatusPanel, Skeleton, Breadcrumbs, Pagination, JsonLd
    ui/button.ts             button class recipe (shared by <button> and <Link>)
  features/
    homepage/                API, section model (pure, tested), SectionRenderer, Hero, sections/*
    products/                API, pricing view-model (pure, tested), ProductCard, ProductPrice, ProductGrid
    catalog/                 categories tree, brands
    markets/                 markets API, market resolution, server action
  lib/
    api/                     client (fetch gateway), zod schemas
    i18n/                    routing, navigation, request config, formatters
    seo/                     metadata builder (pure), JSON-LD builders (pure), site config
    images.ts                image source resolver (current + future renditions)
    env.ts                   server-only env
  proxy.ts                   next-intl locale negotiation (Next 16 "proxy", formerly middleware)
messages/{ar,en}.json        UI strings only (catalog text comes from the API)
```

Server Components by default. Client islands: `AppImage` (error fallback), `Carousel` controls,
`DepartmentsMenu`, `MobileMenu`, `MarketSwitcher`, `LanguageSwitcher`, `ThemeSwitcher`, `Providers`, `error.tsx`.
Product cards, sections, hero, header and footer markup are server-rendered.

## URL, locale and market strategy

- Locales are path prefixes: `/ar` (default, RTL) and `/en`. `/` negotiates via cookie → `Accept-Language`.
- **Market is not in the URL.** It is an httpOnly cookie (`alo_market`) set by a Server Action after
  validating the code against active markets. Crawlers have no cookie and always see `DEFAULT_MARKET`.
  Consequences: one canonical URL per locale, no currency-duplicate pages.
- When a second market gets its own indexable catalog, move to market-qualified paths
  (e.g. `/ar-sa/...`, `/en-ae/...`) with per-market hreflang (`ar-SA`, `en-AE`) and per-market sitemaps.
  The routing helpers (`localizedUrl`, `languageAlternates`) are the single place to change.
- Adding a UI locale: add it to `lib/i18n/routing.ts` + `messages/<locale>.json`. Catalog names will
  still be English/Arabic until the backend stores that language.

## Caching (Next 16, classic fetch cache — `cacheComponents` not enabled)

| Data | Revalidate | Tags |
|---|---|---|
| Homepage sections | 60 s | `homepage`, `homepage:<market>` |
| Product list / detail (prices, stock) | 30 s | `products`, `product:<slug>` |
| Categories, brands, markets | 600 s | `categories`, `brands`, `markets` |

- Pages render per request (they read the market cookie); API responses come from Next's data cache.
- The fetch cache keys on URL **and headers**: `?market=` and `Accept-Language` both partition entries,
  so markets and locales can never be mixed. No cookies/Authorization are ever forwarded → nothing
  user-specific enters the shared cache.
- React `cache()` de-duplicates identical calls inside one render (layout + page + metadata).
- No route-level `loading.tsx` on indexable pages: content is in the initial HTML, never behind a
  client-side swap. Measured: API ~0.7 s cold, ~0.08 s server response warm.
- Tags are in place for future on-demand revalidation (an authenticated webhook from the Admin).

## SEO

- `pageMetadata()` → title (template `%s | ALO MART`), description (≤160 chars, word-boundary),
  canonical, hreflang `ar`/`en`/`x-default`(=ar), Open Graph (+locale), Twitter card, robots.
- **Indexing switch:** only `SITE_INDEXABLE=true` allows indexing. Otherwise every page gets
  `noindex,nofollow`, every response `X-Robots-Tag: noindex, nofollow` (next.config headers — evaluated at
  build time), and robots.txt disallows `/` (evaluated per request). Set the flag at build **and** runtime.
- Thin-page policy: categories with no products and no sub-categories, brands without products → `noindex, follow`.
  Out-of-range `?page=` → 404. Pages > 1 self-canonicalize with `?page=N`.
- Faceted filters (future): filter/sort query combinations must be `noindex, follow` with canonical to the
  unfiltered listing; only curated facet landing pages should be indexable paths.
- Structured data: Organization + WebSite (no `SearchAction` — no search API) on the homepage;
  Product (Offer / AggregateOffer from real selling price, currency, availability, brand only when present,
  seller = store) + BreadcrumbList on product pages; BreadcrumbList on category/brand pages.
  No ratings/reviews. Rich-result eligibility has **not** been validated with Google's tool yet.
- Sitemap: home, categories, products (default market, paged ≤ 50×100), brands that have products — each with
  hreflang alternates.

### Product SEO — implemented vs deferred

Implemented now (minimal product page): unique title/description (API `meta_*` → description → fallback),
canonical, OG image = primary image, Product + Offer JSON-LD with real price/currency/availability,
BreadcrumbList, server-side fetch, 404 for unpublished/unavailable-in-market products.

Deferred to the Product Details phase: variant-level offers & URLs, full gallery/zoom, GTIN/MPN, shipping
& return policy markup (`OfferShippingDetails`, `MerchantReturnPolicy`), reviews (needs a backend source),
Rich Results validation, per-variant availability.

## Images

`AppImage` is the only `next/image` user. `lib/images.ts` picks the best available source:
future `renditions.{thumbnail,card,detail,large,original}` → today's `primary_image_url` / `image_url` /
`logo_url`. next/image then serves AVIF/WebP at device widths (`deviceSizes` trimmed to real slot sizes).
Remote patterns allow only the API host's `/storage/**` plus `IMAGE_REMOTE_HOSTS`.
`priority` → `loading="eager"` + `fetchPriority="high"` (Next 16 deprecates `priority`); used for the hero
mosaic, logo and the first product images on listing/product pages only.

## Hosting

Requires a Node.js ≥ 20.9 server (`next build && next start`) — SSR, Server Actions and the image
optimizer are used, so static export / shared PHP hosting is not suitable.

## API outage behaviour

The staging API is occasionally unreachable (timeouts). The storefront treats an outage as
temporary, never as "not found" and never as indexable content:

| Surface | During an outage |
|---|---|
| Homepage | 200 with the shell (header/footer) and an in-page "couldn't load the catalog" panel — distinct from the empty-market state. |
| Product / category / brand pages | `CatalogUnavailableError` → localized `error.tsx` with **HTTP 500**, so crawlers retry and keep the indexed page (a 200 would index an error message; a 404 would deindex a live product). Unknown slugs still 404. |
| `sitemap.xml` (ISR) | A failed group throws, so a failed background regeneration keeps serving the **last good sitemap** instead of one without products. Consequence: `next build` fails if the API is down while prerendering — retry the build when the API is reachable rather than shipping a partial sitemap. |
