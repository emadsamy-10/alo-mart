# ALO MART public API — contract as consumed by the Storefront

Audited 2026-10-09 against `https://api.alo-mart.web-apps.site/api/v1` (staging) and the
Laravel source (`Modules/*/routes/api.php`, `PublicProductCatalogService`, `Homepage` module).
The Storefront is **read-only** in Phase 1 and never sends credentials.

## Conventions

| Concern | Behaviour |
|---|---|
| Envelope | `{ "status": bool, "message": string, "data": … }` — errors have `status:false`, `data:null` |
| Locale | `Accept-Language: ar \| en` (middleware `ResolveLocale`). Catalog names/titles come back localized. Only `en`/`ar` content exists in the DB. |
| Market | `?market=EG` (code). Unknown/inactive → **404** `"The requested market is not available."`. Omitted → API default market (**SA**, which currently has no homepage content). |
| Money | Decimal **strings**, 4 dp (`"4350.0000"`). `currency: { code, symbol, decimal_places }` per market. No conversion anywhere. |
| Pagination | `data: { items: [], meta: { current_page, last_page, per_page, total } }`; `per_page` default 20, max 100. |
| Images | Absolute URLs under `https://<api-host>/storage/…` (uuid file names, `Cache-Control: max-age=604800`). |

## Endpoints used

| Endpoint | Used for | Revalidate |
|---|---|---|
| `GET /homepage?market=` | Homepage sections | 60 s |
| `GET /markets` | Market switcher, market validation | 600 s |
| `GET /categories?market=` | Mega menu, hero, category pages, sitemap | 600 s |
| `GET /products?market=&category_id=&brand_id=&store_id=&page=&per_page=` | Category/brand listings, sitemap | 30 s |
| `GET /products/{slug}?market=` | Product page (404 when not public in market) | 30 s |
| `GET /brands`, `GET /brands/{slug}` | Brand page, sitemap | 600 s |

Not used yet: `/stores`, `/stores/{slug}`, `/currencies`, `/countries`, `/markets/default`, `/categories/{slug}`.

## `GET /homepage?market=EG`

```jsonc
{ "market": { "id": 1, "code": "EG" },
  "sections": [{
    "id": "uuid", "type": "category_products", "content_kind": "product",
    "title": "Best Sellers", "subtitle": null,          // localized; Admin-authored
    "layout": "carousel",                                 // product: carousel|grid; category/brand: carousel|grid|tiles
    "sort_order": 1,
    "target": { "kind": "category", "id": 1, "slug": "furniture" },   // category_products / brand_products only
    "items": [ /* product cards | category cards | brand cards */ ] }] }
```

- Only enabled, publishable sections are returned, already ordered and limited (`item_limit` is applied server-side and not exposed).
- Types: `best_sellers, top_rated, new_arrivals, featured_products, deals, category_products, brand_products, featured_categories, featured_brands`.
  `top_rated` is never published (`no_ratings_source`).
- Section titles are free text: on staging a `category_products` section is titled "Best Sellers" — the Storefront shows the Admin's title verbatim and does not treat it as sales ranking.

### Product card (shared by homepage, `/products`)

```jsonc
{ "id": 56, "name": "…", "slug": "oasis-minimal-writing-desk",
  "primary_image_url": "https://…/storage/products/56/media/<uuid>.webp",
  "primary_image": { "alt_text", "width_px", "height_px", "renditions": { "thumbnail|card|detail|large|original": { "url", "width_px", "height_px" } }, "srcset" },  // NOT yet on staging (backend HEAD only)
  "store": { "id", "name", "slug" }, "category": { "id", "name", "slug", "path": [ … root→leaf ] },
  "brand": { "id", "name", "slug" } | null,
  "market": { "id", "code" }, "currency": { "code": "EGP", "symbol": "ج.م", "decimal_places": 2 },
  "price_from": "4350.0000", "price_to": "4350.0000", "has_price_range": false,   // SELLING prices (sale applied)
  "published_at": "…", "is_in_stock": true,
  "deal": { "regular_price", "sale_price", "discount_percent" }   // deals sections only
}
```

Category card: `{ id, name, slug, image_url, level, has_children, path }`. Brand card: `{ id, name, slug, logo_url }`.

## Known backend limitations (documented, not worked around)

1. **No text search** — `/products` has no `q` parameter → no search UI, no `SearchAction` JSON-LD.
2. **Exact category filter** — `category_id` does not include descendants, so parent departments list only products assigned directly to them. Category pages say so explicitly.
3. **No sorting / price / facet filters** on `/products` (only newest first).
4. **No ratings or reviews** source → no stars anywhere, no `aggregateRating`.
5. **No banner / CMS endpoint** → the hero is static copy + real department imagery.
6. **Default market SA has no merchandising** on staging → Storefront default is `DEFAULT_MARKET=EG`.
7. **Responsive renditions** are committed in the backend but not deployed to staging; the image resolver already supports them.
8. **Category detail** (`/categories/{slug}`) does not return children; the tree endpoint is used instead.
9. Brand list `logo` vs homepage brand `logo_url` naming differs; both handled.

## Phase 2 audit — shopping capabilities (2026-10-10)

| Capability | Public API today | Storefront behaviour |
|---|---|---|
| Product detail | `GET /products/{slug}?market=` — media with renditions (thumbnail/card/detail/large/original), variants with `options[{attribute{id,name,code,input_type}, value{id,name,code,display_value}}]`, per-variant `price`, `sale_price`, `is_in_stock`, per-variant `media`, attributes, store (name, logo, description) | Full product page; variant selector driven by these options; swatches only for `input_type=color` with a valid hex `display_value` |
| Stock | `is_in_stock` boolean per variant/product — **no quantity** | Out-of-stock variants can't be added; quantity capped at 99 client-side |
| Cart | `/v1/user/cart` (GET, POST items `{product_variant_id, quantity, market}`, PUT/DELETE items) — **`auth:user` only** | Guest cart in localStorage, per market, keyed by variant id (same identity as the API). Not synced, no reservation, no checkout |
| Wishlist | `/v1/user/wishlist` (GET, POST items, DELETE items/{product}) — **`auth:user` only** | Guest wishlist in localStorage, keyed by product id |
| Customer auth | `/v1/user/auth/{register,login,logout,me}` exist | Not built in the storefront yet (future phase) |
| Listing filters | `/products?category_id=&brand_id=&store_id=&page=&per_page=` — single values, **exact** category (no descendants) | Category / brand / store filters, catalog-wide, URL-driven |
| Sorting | none — always `published_at desc, id desc` | "Newest first" shown as a label |
| Stores | `/stores?per_page=` (public, eligible stores only) | Store filter |

### Backend work needed for the rest of the brief

1. **Sorting** — `sort=newest|price_asc|price_desc` on `/products`, ordering by the market selling price (`price_from`) with a stable tiebreak (`id`). Best-selling needs an order-count source; top-rated needs reviews.
2. **Price range** — `min_price` / `max_price` (market currency, selling price) on `/products`, plus catalog-wide bounds for the current filters (e.g. `meta.price_min/price_max`) so the slider isn't guessed from one page.
3. **Availability & discounts** — `in_stock=1` and `on_sale=1` filters using the same rules as `is_in_stock` and `dealOf()`.
4. **Category subtree** — `include_descendants=1` (or default) so a department lists its sub-categories' products.
5. **Multi-select** — `brand_id[]` / `category_id[]`.
6. **Attribute facets** — filter by select/color attribute values (e.g. `attr[color]=black,white`) and a facets endpoint returning the applicable attributes, values and counts for a category (respecting inherited category attribute rules).
7. **Facet counts** — counts per category/brand/store for the current filters.
8. **Text search** — `q=` with relevance ordering.
9. **Customer accounts in the storefront** — then sync the guest cart (`POST /v1/user/cart/items` per line) and wishlist on sign-in.
10. **Stock quantities** (or a max-purchasable per variant) so the quantity selector can respect real limits.
