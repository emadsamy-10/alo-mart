# ALO MART public API — contract as consumed by the Storefront

Audited 2026-10-09 against `https://api.alo-mart.web-apps.site/api/v1` (staging) and the
Laravel source (`Modules/*/routes/api.php`, `PublicProductCatalogService`, `Homepage` module).
The Storefront was **read-only** in Phase 1. Since the customer-accounts phase (2026-10-27) it also calls the
`/v1/user/*` API on behalf of a signed-in customer — server-side only, see **Customer accounts**.

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
| `GET /products?market=&category_id=&brand_id=&store_id=&page=&per_page=` | Brand listings, sitemap, related products (legacy scalar filters) | 30 s |
| `GET /products?market=&category_id[]=&include_descendants=1&…` | **/products catalog** (every filter, search, sort) and category pages (subtree) | 30 s |
| `GET /products/facets?market=&…` | **/products filter panel**: counts, price bounds, attribute facets | 30 s |
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

1. ~~No text search~~ — **resolved** by the catalog-filtering backend (`q`; see “Advanced catalog” below).
2. ~~Exact category filter~~ — **resolved**: `include_descendants=1` lists a subtree; category pages use it.
3. ~~No sorting / price / facet filters~~ — **resolved** (`sort`, `min_price`/`max_price`, `in_stock`, `on_sale`, `attr[…]`, `/products/facets`).
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
| Customer auth | `/v1/user/auth/{register,login,logout,me}` exist | Built 2026-10-27 — see **Customer accounts** below |
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

## Advanced catalog (2026-10-26) — `/products` + `/products/facets`

Authoritative contract: backend `docs/catalog-filtering-api.md` (branch `feature/catalog-filtering`,
commits `90d705e` / `2cc03b7`). What the storefront sends and relies on:

| Storefront URL (`/[locale]/products?…`) | API parameter | Notes |
|---|---|---|
| `q=<text>` (2–100 chars) | `q` | Arabic/English; `q` without `sort` = the API's relevance order (FULLTEXT) or newest (substring fallback) |
| `category=<slug>` (repeat) | `category_id[]=<id>` | slugs resolved against `/categories`; unknown slugs are dropped |
| `descendants=1` | `include_descendants=1` | sent only when a chosen category has children; explicit in the UI (switch + chip) |
| `brand=<slug>`, `store=<slug>` (repeat) | `brand_id[]`, `store_id[]` | OR within a group, AND across groups |
| `min=<dec>`, `max=<dec>` | `min_price`, `max_price` | exact decimal strings (≤ 10 integer digits, ≤ 4 decimals), selling price |
| `in_stock=1`, `on_sale=1` | `in_stock=1`, `on_sale=1` | the API accepts only `1`/`0` |
| `attr.<code>=v1,v2` | `attr[<code>]=v1,v2` | only with a category (the API rejects attributes without one) |
| `sort=<key>` | `sort` | `newest, price_asc, price_desc, name_asc, name_desc, best_selling` |
| `page=<n>` | `page` (+ `per_page=24`) | server-side pagination |

- Listing and facets are fetched **in parallel** with identical filter parameters (facets never receive
  sort or paging), so `facets.total` equals `meta.total`.
- Facet counts are catalog-wide **drill-down** counts (each group counted with its own selection removed),
  so they do not sum to `total`. Category counts are per product's **own** category; the UI adds up a
  subtree only when sub-categories are included, so a row's number is what choosing it returns.
- `price.min` / `price.max` ignore the selected price range (backend HEAD) and are the slider's outer limits.
- Cards: `matched_variant` is optional and decided **per product**. When present the card shows that
  variant's selling price (a struck list price only when it is higher) and links to
  `/products/<slug>?variant=<id>`; the product page honours the id only for one of that product's variants.
- Search ordering label: the sort control offers **“Best match”** only when the API really ranks the search.
  `searchUsesRelevance()` (`features/catalog/filters.ts`) mirrors the contract (§4–5, `CatalogSearch::tokens` +
  `CatalogQuery::canUseFulltext`): after the same Arabic normalization, every token must be ≥ 3 characters,
  letters/digits only and not a stopword. Otherwise the API uses a newest-first substring match and the default
  option reads **“Newest first”**. Caveat: a **SQLite** backend (local development only) never uses FULLTEXT, so
  there a ranked-looking term is still newest-first; MariaDB staging/production behave as labelled.
- 422 handling: `attr.<code>` errors → that attribute is dropped, the request retried once, and a notice is
  shown; any other 422 → an in-page "couldn't apply these filters" panel with a reset link. Outages → the
  error boundary (HTTP 500) whose **Try again** uses Next's `retry()`, which re-fetches.

### Environment status (verified 2026-10-26, GET requests only)

| Behaviour | Local backend HEAD `2cc03b7` | Staging API |
|---|---|---|
| `/products/facets`, `q`, `sort`, price, stock, sale, `attr`, `include_descendants`, `matched_variant` | ✓ | ✓ |
| Price bounds ignore the selected range | ✓ | ✗ (bounds narrow to the selection) |
| `market[]=EG` → 422 | ✓ | ✗ (500) |
| Per-product attribute location (contested attributes) | ✓ | not verifiable from outside (older build) |

The storefront behaves correctly on both. The slider track is the facet bounds **widened to contain the
selection**, so on the older staging build the handles still render correctly; the shopper just cannot
drag beyond the narrowed bounds (typing a wider range works) until staging runs the backend HEAD.

### Image reliability (verified 2026-10-26)

The `/_next/image` 500/504 responses seen during local QA came from PHP's **single-threaded** built-in server
(`php -S`) serving the original images while the optimizer fetched several at once. Same page set (12 pages ×
2 widths, 4 pages in parallel, empty image cache):

| Image origin | `/_next/image` responses | 5xx |
|---|---|---|
| Local backend on `php -S` | 489 | **152** (504) |
| Local backend, images served by a concurrent static server | 510 | 0 |
| Staging API (real web server) | 514 | 0 |

Not reproducible under a proper server — no storefront change needed. Local QA should serve `/storage` concurrently.

## Backend change requests (not implemented here — the backend is read-only for the storefront)

### BR-1 · Attribute facets for a parent category with `include_descendants` (recommended)

**Today** (`CatalogFacets::attributes()`, `IndexPublicProductsRequest::filterableAttributeCodes()`, design spec §12.2):
attribute facets and attribute validation use only the **explicitly requested** category ids; descendants added by
`include_descendants=1` are deliberately not unioned. So *Furniture + sub-categories* returns no attribute facets,
and `attr[material]=…` on it is a 422 (“not filterable”). The storefront shows a hint instead and does **not** work
around it (no invented facets, no client-side expansion of the subtree).

**Evidence that the data supports it** (GET only): requesting the same subtree as explicit `category_id[]` ids
returns the identical `total` for every parent (17 parents, local HEAD and staging) and exposes the attributes,
e.g. Furniture → `material, finish, bed-size`; Fashion → `color, apparel-size, material, shoe-size-eu`.
The storefront does not rely on this: it would duplicate the backend's descendant resolution and break past the
50-id cap.

**Recommended change** (backend):
1. When `include_descendants=1`, build the attribute set from the **resolved** category set
   (`CatalogQuery::resolveCategoryIds()` — requested + descendants): union of `EffectiveCategoryAttributes::rows()`
   filtered to `is_filterable` and active attributes. Keep the requested categories' configured order first, then
   descendants by (level, sort_order).
2. Use the **same** union in `filterableAttributeCodes()` so `attr[<code>]` validates on a parent + descendants.
3. No change to matching or counts: the per-product attribute plan already locates each attribute by the product's
   own category, so `attr[bed-size]=160x200` on *Furniture + sub-categories* simply returns the matching beds.
4. Optional: per attribute, report how many products in the current set carry it (e.g. `coverage`), so a client can
   label narrow attributes ("Beds only").
5. Tests: Furniture+desc exposes `bed-size`; filtering by it returns only beds; unknown codes still 422; the 50-id
   cap still applies to requested ids; facets.total still equals the listing total.

**Storefront impact:** none required — the panel renders whatever `attributes` the facets endpoint returns, and the
hint disappears automatically.

### BR-2 · Report the applied order (optional)

Add the effective order to the listing response (e.g. `meta.order`: `relevance` | `newest` | the explicit sort key).
The storefront could then drop its mirror of the FULLTEXT eligibility rule and would also label correctly on a
SQLite backend.

### BR-3 · Deploy backend HEAD to staging (blocking for release)

Staging runs an older catalog build (see the table above): price bounds narrow to the selected range, `market[]`
returns 500, and per-product attribute location cannot be verified there.

## Customer accounts (2026-10-27)

### How the storefront talks to the account API

| Concern | Behaviour |
|---|---|
| Where calls run | **Server only** (Server Components + Server Actions, `src/features/account/*`). The browser never calls the API with a token. |
| Token storage | Sanctum token in ONE cookie `alo_session`: `httpOnly`, `SameSite=Lax`, `Secure` in production, `path=/`, max-age = the token's own `expires_at`. Never in localStorage/sessionStorage, URLs, logs or HTML. |
| CSRF | Every mutation is a Server Action (POST); Next.js rejects actions whose `Origin` ≠ host. SameSite=Lax blocks cross-site cookie sends. |
| Caching | `apiAccount()` always uses `cache: "no-store"`: customer data never enters the shared data cache. Geography (`/countries`, regions, cities) is public and cached 1 h. |
| Session end | Any `401` from `/v1/user/*` clears the cookie and sends the customer to `/login?next=<current path>`. API outage (5xx/timeout) shows an error state, never a fake signed-out page. |
| Return URLs | `?next=` accepts only same-site, locale-less paths (`safeNext`, unit-tested against absolute, protocol-relative, backslash, encoded and auth-page targets). |
| Rate limits | The storefront forwards the shopper's IP as `X-Forwarded-For`. The backend honours it only from `TRUSTED_PROXIES` (see backend change CA-2). |
| Session names | `device_name` = coarse UA label ("Chrome on Windows") so customers recognise sessions. |

### Endpoints used

| Endpoint | Used for |
|---|---|
| `POST /user/auth/register` `{name,email,phone,password,password_confirmation,device_name}` | Registration (no role/status fields are ever sent) |
| `POST /user/auth/login` `{email,password,remember,device_name}` | Sign-in; `remember` → 30-day token, else 12 h |
| `POST /user/auth/logout`, `GET /user/auth/me` | Sign-out; current customer (once per request) |
| `POST /user/auth/email/verify` `{token}`, `POST /user/auth/email/resend` | Verification page (submitted by script after load, never on GET); resend (60 s cooldown → `429 code=resend_too_soon`) |
| `POST /user/auth/password/forgot` `{email}`, `POST /user/auth/password/reset` | Recovery (same answer for unknown emails; `422 code=reset_invalid`) |
| `PUT /user/auth/password`, `PUT /user/auth/email`, `PUT /user/auth/phone` (all need `current_password`) | Account security |
| `GET /user/auth/sessions`, `DELETE /user/auth/sessions/{id}`, `POST /user/auth/sessions/revoke-others` | Signed-in devices |
| `PUT /user/profile` `{name,gender,date_of_birth}` | Profile |
| `/user/addresses` (GET, POST, GET/PUT/DELETE `{id}`, PUT `{id}/default`) + `/countries`, `/countries/{id}/regions`, `/regions/{id}/cities` | Address book with dependent selects |
| `GET /user/orders?page=&per_page=10`, `GET /user/orders/{uuid}` | Order history and detail |
| `/user/cart` (GET/DELETE `?market=`, POST items, PUT/DELETE items/{id}), `/user/wishlist` (GET, POST items, DELETE items/{product}) | Signed-in cart and wishlist; guest data merged once at sign-in |

Error codes the UI relies on: `verification_invalid` (422), `verification_expired` (410), `resend_too_soon` (429),
`reset_invalid` (422), `mail_delivery_failed` (503); wrong current password = `422 errors.current_password`.

### Backend changes this phase (branch `feature/customer-auth`, uncommitted, awaiting approval)

- **CA-1 · Customer email verification, password recovery, account security, sessions** — new endpoints above;
  table `user_email_verification_tokens` (sha256 hashes, 24 h expiry); customer emails (verify, reset, password
  changed, email changed) in ar/en linking to `STOREFRONT_URL`; customer tokens now expire (`users.session.hours`=12,
  `remember_days`=30); a deactivated customer's tokens stop working. Merchant/admin auth unchanged (tested).
- **CA-2 · `TRUSTED_PROXIES` (opt-in)** — without it every shopper shares the storefront server's IP, so the per-IP
  login (20/min) and registration (5/min) limits would be **site-wide**. Set it to the storefront's egress address(es)
  in each environment. Empty (default) = behaviour unchanged.
- **Deploy needs:** run the new migration; set `STOREFRONT_URL`, `TRUSTED_PROXIES`; a working mail transport.

## Checkout, payment & stores (2026-10-28)

| Endpoint | Used for |
|---|---|
| `POST /user/checkout/quote {market,address_id,shipping_selections[]}` | Checkout page; every amount shown comes from here (re-quoted on each change) |
| `POST /user/orders {idempotency_key,market,address_id,shipping_selections}` | Place order (201 created / 200 replay of the same key / 409 key reused for a different order / 422 `checkout_not_ready` with blockers) |
| `GET /user/payment-methods?market=` | Payment step (codes + names; providers stay server-side) |
| `POST /user/orders/{uuid}/payment {payment_method,idempotency_key}`, `GET …/payment` | Start/retry payment; `current_attempt.action.url` (followed only if https); status only from the provider webhook |
| `GET /stores`, `GET /stores/{slug}` | Store directory and pages (incl. merchant `policies`) |
| `GET /settings` | `platform.support_email` in the footer |

- **No guest checkout** in the backend (`auth:user`): the storefront sends guests to sign-in; their device cart merges on the way.
- **Payments:** the only driver is `sandbox` (test/local). A real gateway needs a backend driver + credentials (**external blocker**). No cash-on-delivery driver exists, so a market without an online method can't place orders (the UI explains this).
- **BR-3 status (2026-10-28):** staging serves facets/search/sort but not commit `90d705e` (self-excluding price bounds) — the staging E2E skips exactly that test.

## Order lifecycle (2026-10-30) — backend branch `feature/order-lifecycle` (uncommitted, awaiting approval)

| Endpoint / field | Used for |
|---|---|
| `GET /user/orders/{uuid}` → `payment_due_at`, `payment_expired`, `cancelled_at`, `cancellation_reason`, `refund_status`, `can_cancel`, `stores[].status`, `stores[].refund`, `stores[].status_timestamps`, `timeline[]` | Order page: "pay by" deadline, per-store status chips, cancelled / expired / late-payment / refund-under-review notices |
| `POST /user/orders/{uuid}/cancel` | "Cancel order" (in-page confirmation, Server Action `cancelOrderAction`) — 200 cancelled; 409 with the API's message when paid or while a payment is processing |
| `POST /user/orders/{uuid}/payment` | Now 409 `payment_window_expired` after the deadline and 409 `order_not_payable` for a cancelled order (the page no longer offers payment then) |

- **Payment vs fulfillment** stay separate: `payment_status` ∈ `unpaid`/`paid`/`paid_after_cancellation`; `status` (order and per store) ∈ `placed`/`confirmed`/`processing`/`shipped`/`delivered`/`cancelled`. The page derives everything in `src/features/account/order-view.ts` from these fields only.
- **Backward compatible:** every new field is optional in the schema; against an API without them (today's staging) the page behaves as before, minus the deadline/cancel UI.
- **Never shown as paid:** `paid_after_cancellation` (provider paid after the order was cancelled) is "Payment received after cancellation — it will be refunded"; refunds are manual (`pending_manual_review`), never claimed as completed.
