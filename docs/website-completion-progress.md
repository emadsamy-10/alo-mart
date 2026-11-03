# ALO MART Website — completion progress ledger

Durable, resumable record of the "complete website" mission. Update after every major phase.
Older phase notes: `qa/auth-progress.md` (git-ignored), `docs/api-contract.md`.

## Resume here (always read first)

1. `git status` in both repos (website `E:\workspace\alo-mart\alo-mart-website`, backend `E:\xampp\htdocs\alo-mart`).
2. Read **Current phase** and **Next step** below.
3. Local runtime (disposable, never staging): see **Local runtime** at the bottom.
4. Never commit/push/deploy without approval. Never write to staging.

## Current phase / next step

**Staging-candidate verification (2026-11-02, local; not pushed or deployed).** It goes with backend `feature/staging-candidate` @ `50467e6` (in `E:\workspace\alo-mart\worktrees\staging-candidate`), which is `feature/backend-integration` merged with `origin/master`, plus batched commission readiness. See §13–§15 of `docs/backend-integration-staging-readiness.md` there.

- **No website code change:** a store without an effective commission rule gets the API's existing localized `store_unavailable` blocker, which checkout already shows.
- **New test 60** in `tests/e2e/account/checkout.spec.ts`: a two-store cart where one merchant has no usable commission rule.
  - Checkout shows "This store is not accepting orders right now." and keeps "Place order" disabled, never mentioning commission.
  - A direct API order is refused with 422 `store_unavailable`, reserving nothing and creating no order.
  - After the test rows are removed, both stores order together.
  - It works only in the disposable local database, through `localDb`: rows are tagged and cleaned before and after, and the platform rule is never touched. `ensureTestStock()` now also tops up variant 1.
- **Results:**
  - tsc, eslint, unit tests: exit 0, exit 0, 218/218;
  - production build: exit 0;
  - Playwright full suite (1 worker): **143 passed, 69 skipped, 0 failed, exit 0**;
  - outage spec: 1/1 (exit 0).

**Pre-staging fixes (2026-11-01): UNCOMMITTED, awaiting review.** They go with backend `feature/backend-integration` @ `76cd619` plus its working-tree changes; see `docs/backend-integration-staging-readiness.md` §0 in that worktree.

- **Code:**
  - The backend now refuses a NEW order for an unverified email (403 `email_unverified`) and limits new placements per customer (429 `order_rate_limited`, `retry_after`).
  - Checkout shows a `VerifyEmailNotice` with the existing resend form, up front and again after a refusal (it sits outside the checkout `<form>`).
  - `placeOrderAction` surfaces the API's localized message for both codes and keeps the cart and address.
  - The verify-email success page links to checkout.
  - EN/AR copy is added under `Checkout.errors.emailUnverified`, `Checkout.verifyEmail.*` and `Auth.verify.toCheckout`.
  - BR-1 needs no website code: main categories already send `include_descendants`.
- **Tests:**
  - new `tests/e2e/account/order-verification.spec.ts` (58, 59);
  - a BR-1 browser test in `tests/e2e/catalog.spec.ts`; it skips on a backend without BR-1, such as today's staging;
  - order-placing specs verify their shoppers through the real emailed link (`verifyShopperEmail`, `createVerifiedShopper`).
- **Results:**
  - tsc, eslint, unit tests: exit 0, exit 0, 218/218;
  - production build: exit 0;
  - Playwright full suite (1 worker): **142 passed, 68 skipped, 0 failed, exit 0**;
  - outage spec: 1/1.

**Order lifecycle integration (2026-10-30, uncommitted, awaiting approval).** It needs backend branch `feature/order-lifecycle`; see `E:\workspace\alo-mart\worktrees\order-lifecycle\docs\order-lifecycle-progress.md`.

- **Code:**
  - `src/features/account/order-view.ts` is a pure view model built from API fields only;
  - lifecycle fields in `schemas.ts` are optional, so staging and older APIs keep working;
  - `cancelOrderAction` and the `ui/CancelOrder.tsx` confirmation step;
  - the order detail page shows a "pay by" deadline, a status chip per store, a "refund under review" chip, and notices for cancelled, expired, late-payment and refund states;
  - the payment section is hidden once the order is not payable;
  - en/ar copy under `Account.orders`.
- **Tests:**
  - unit `tests/unit/order-lifecycle.test.ts` with real API fixtures in `tests/unit/fixtures/orders/`; unit total 218/218;
  - E2E `tests/e2e/account/order-lifecycle.spec.ts` (54–57), with shared helpers moved to `tests/e2e/account/orders.ts`;
  - lifecycle and checkout E2E: 9/9 against the integration runtime;
  - tsc and eslint are clean.
- **Final verification (2026-10-31):**
  - unit 218/218; tsc, eslint and production build all exit 0;
  - full E2E (1 worker): 137 passed, 66 skipped, 1 failed. The failure was environmental (`ERR_NETWORK_IO_SUSPENDED`, the machine slept), and the discovery spec then passed on its own: 11 passed, 3 skipped.
  - Account test 37 was updated: its `"Placed"` text check is now scoped, because the order page also shows a per-store status chip.
- **Clean full E2E (2026-10-31, final backend including the Settlements guard):** 138 passed, 66 skipped, 0 failed, Playwright exit 0 (1 worker, 10.7 min). The 66 skips are the opt-in outage spec, other-device/mobile-only projects and staging-only checks, as before.
- **Runtime:** `<scratch>/web/backend-ol` with `ALO_BACKEND_DIR=<scratch>/integration-ol`. The integration copy is catalog-filtering plus the customer-auth and order-lifecycle diffs.

- Phase 0 audit: **DONE** (2026-10-28).
- Phase 9/10 checkout + confirmation + payment: **IMPLEMENTED** (unverified until E2E) — see Phase log.
- Header search, store pages, footer support/shop links, sitemap stores: **IMPLEMENTED**.
- Unit (checkout model) ✅ 14 · checkout E2E ✅ 5/5 · outage E2E ✅ 1/1 · discovery E2E ✅ 11/11.
- Responsive sweep ✅ 560 checks (14 routes guest + 8 account × 7 widths × ar/en × light/dark): 1 real defect (360px address form labels) fixed.
- SEO check of new pages ✅ (canonical, hreflang, JSON-LD, sitemap stores; checkout/account noindex + 307 to sign-in).
- Unit ✅ 210/210 · read-only E2E (catalog/shopping/storefront/discovery) ✅ 82 passed / 8 skipped.
- Account E2E (all specs incl. checkout, 1 test worker) ✅ 52 passed / 54 skipped (other-device project + opt-in outage) · outage ✅ 1/1.
- Staging read-only E2E ✅ 80 passed / 10 skipped / 0 failed. **BR-3 still open (narrowed):** staging lacks backend commit 90d705e (self-excluding price bounds) — the only staging-specific skip.
- **Phase status: all independently achievable website work done. Awaiting owner: commit approval, backend deploys, payment gateway.**

## Repository state at audit (2026-10-28)

| Repo | Branch | State |
|---|---|---|
| Website | `master` @ `a95627c new pages` | clean — catalog + accounts phases committed by the owner |
| Backend (active checkout) | `feature/catalog-filtering` @ `2cc03b7` | clean, untouched |
| Backend auth worktree | `feature/customer-auth` (scratchpad worktree, base `9cbe949`) | **uncommitted** (32 entries); backup `E:\workspace\alo-mart\backups\customer-auth-2026-10-27` |

## Staging vs local API (read-only probes 2026-10-28)

| Capability | Staging | Notes |
|---|---|---|
| Catalog `/products` (sort, q, filters), `/products/facets` | ✅ 200 | BR-3 to re-verify with the staging E2E suite |
| Checkout `POST /user/checkout/quote`, orders, `GET /user/payment-methods` | ✅ routes exist (401/405 unauthenticated) | |
| Customer-auth additions (verify, reset, sessions, …) | ❌ 404 | branch `feature/customer-auth` not deployed |
| Geography | ⚠️ Egypt has 1 region | addresses limited until admins add regions/cities |
| Public settings `/settings` | ✅ `platform.support_email`, `ui.homepage_sections` | |
| Stores `/stores`, `/stores/{slug}` | ✅ 7 stores | no store pages on the website yet |

## Backend capability facts (read-only audit)

- Checkout is **authenticated only** (`auth:user`): no guest checkout in the backend.
- Flow: `POST /user/checkout/quote {market,address_id,shipping_selections[]}` → `POST /user/orders {idempotency_key,market,address_id,shipping_selections}` → `POST /user/orders/{uuid}/payment {payment_method,idempotency_key}` → `action.url` redirect; result **only** by provider webhook; `GET /user/orders/{uuid}/payment` for status.
- Payment drivers: **only `sandbox`** (test/local only: redirect to a non-routable `.invalid` host, HMAC-signed webhook). No cash-on-delivery driver, no real gateway → real online payment is **BLOCKED BY EXTERNAL SERVICE** (gateway contract + credentials).
- No CMS/static pages, no newsletter, no coupons, no reviews endpoints → those features are **not built** (no fake UI).

## Feature inventory

Legend: ✅ complete & verified · 🟡 implemented, not verified · 🟠 partial · ❌ missing · ⛔ blocked (backend/external)

| Module | Status | Notes |
|---|---|---|
| Homepage (hero, sections, sliders) | ✅ | API-driven sections; verified in earlier phases |
| Navbar / mega menu / mobile menu | ✅ | + header search (desktop popover, mobile menu) |
| Language / theme / market switchers | ✅ | |
| Footer | ✅ | + shop links, support email from `/settings` |
| Categories (pages, subtree, breadcrumbs) | ✅ | |
| Brands | ✅ | |
| Stores | ✅ | /stores, /stores/[slug], sitemap, "Sold by" links |
| Product catalog (filters, facets, search, sort, pagination) | ✅ | 71/5 local E2E; staging re-verify pending |
| Product details (gallery, variants, ?variant=, wishlist, cart) | ✅ | |
| Search | ✅ | header + /products; ar/en |
| Auth (register, login, logout, recovery, verification, sessions) | ✅ local · ⛔ staging | needs backend branch deploy |
| Account (dashboard, profile, security, addresses, orders) | ✅ local | |
| Wishlist (guest + account sync) | ✅ | |
| Cart (guest + account, drawer, page) | ✅ | proceed to checkout; server totals at checkout |
| Checkout (address, shipping, payment, place order) | ✅ local | signed-in only (backend); E2E 48–52 |
| Payment | ✅ contract (sandbox) · ⛔ real gateway | verified with signed sandbox webhooks; no real driver/credentials |
| Order confirmation / post-purchase | ✅ local | confirmation banner, payment panel, retry |
| Informational pages (about, terms, privacy…) | ⛔ business | no authoritative content; not invented |
| Newsletter | ⛔ backend | no endpoint |
| Localization ar/en, RTL, dark | ✅ | per phase |
| SEO | ✅ | re-audit at the end |

## Phase log

### Phase 0 — audit (2026-10-28) — DONE
Findings above.

### Phase 9/10 — checkout, payment, confirmation (2026-10-28) — IMPLEMENTED
- New: `src/features/checkout/{schemas,model,api,actions}.ts`, `ui/{CheckoutForm,PaymentPanel,CartResync}.tsx`, page `src/app/[locale]/checkout/page.tsx`.
- Flow: sign-in required (backend has no guest checkout) → address (saved; "add address" returns via safe `next`) → server quote with default shipping per store → change address/shipping = re-quote (server totals only) → payment method (from `/user/payment-methods`) → Place order (server-generated idempotency key; replay = same order) → payment initiation (key derived from the order key) → `/account/orders/{id}?placed=1` confirmation + payment panel.
- Payment panel (order page): paid / continue to provider (https-only action URL) / confirming (refresh) / failed or unpaid (choose method, retry with fresh key). Only the backend's webhook-driven status is shown.
- Order schema gained `market`; address form gained `next`; cart summary/drawer gained "Proceed to checkout"; "checkout opens soon" copy replaced.
- Local runtime: sandbox payments enabled (boot.php, secret in `<scratch>/sandbox-webhook-secret.txt`), payment method `card` routed to `sandbox` for EG (scratch DB only).
- Contract fixtures: `tests/unit/fixtures/checkout/*.json` (real local responses; `checkout-probe.mjs` in scratch).

### Bugs found & fixed by the new E2E (2026-10-28)
- Address form at 360px: "Optional" labels overflowed the 3-column building/floor/unit row → labels wrap (`fields.tsx`). Found by `qa/site-sweep.mjs`.
- Guest → sign-in from checkout landed on "cart is empty": the server rendered before the client merged the guest cart. Fix: `AccountShopSync` calls `router.refresh()` after a merge that moved items.
- Mobile menu search never submitted: closing the drawer on submit unmounted the form first. Fix: no close (GET navigates anyway).
- New specs: `tests/e2e/account/checkout.spec.ts` (48–52), `tests/e2e/account/outage.spec.ts` (53, opt-in `E2E_OUTAGE=1`), `tests/e2e/discovery.spec.ts` (read-only, staging-safe). Env: `E2E_SANDBOX_SECRET_FILE=<scratch>/sandbox-webhook-secret.txt`.

### Discovery & navigation (2026-10-28) — IMPLEMENTED
- Header search (`components/layout/HeaderSearch.tsx`): GET form → `/products?q=`; desktop popover + mobile menu.
- Stores: `/stores` directory and `/stores/[slug]` (profile, contact links, merchant policies, products, pagination, JSON-LD breadcrumbs); PDP "Sold by" links; sitemap includes stores with products.
- Footer: Shop links (products, stores, account, orders) + support email from `/settings` (`features/settings/api.ts`).

## Tests (latest)

| Gate | Result | When |
|---|---|---|
| Unit (vitest) | 210/210 | 2026-10-28 |
| Account E2E incl. checkout (local, 1 worker) | 52 passed / 54 skipped (other device + opt-in) | 2026-10-28 |
| Outage E2E (local, opt-in) | 1/1 | 2026-10-28 |
| Catalog/shopping/storefront/discovery E2E (local) | 82 passed / 8 skipped | 2026-10-28 |
| Same suites against STAGING (read-only) | 80 passed / 10 skipped / 0 failed | 2026-10-28 |
| Responsive sweep (qa/site-sweep.mjs) | 560 checks, 0 open failures | 2026-10-28 |
| Backend full PHPUnit (auth worktree) | 3304 OK, 10 skipped | 2026-10-27 |

## Known blockers

1. Real payment gateway (credentials + driver) — external.
2. Customer-auth backend branch not deployed to staging.
3. Staging geography data thin (1 Egyptian region).
4. Informational/legal page content — business approval.
5. Newsletter, coupons, reviews — no backend.

## Local runtime (disposable)

Scratch backend = integration worktree (catalog-filtering + auth changes) served by
`<scratch>/web/backend` (`php -S 127.0.0.1:8099 router.php` + `node front.mjs 8098 8099`; one PHP worker for
write-heavy E2E). DB `<scratch>/web/backend/db.sqlite` (demo catalog + seeded geography, shipping, VAT,
commission). Mail → `<scratch>/integration/storage/logs/laravel.log`.
Website: `ALO_API_BASE_URL=http://127.0.0.1:8098/api/v1 SITE_URL=http://localhost:3100 npm run build`
(API must be up: sitemap prerender), then `npx next start -p 3100` (add `ALO_API_TIMEOUT_MS=20000` with one worker).
`<scratch>` = `C:/Users/pc/AppData/Local/Temp/claude/E--xampp-htdocs-alo-mart/c2d18b94-9d96-483e-89cc-4649cbda7046/scratchpad`.

## Local commits (2026-10-28, approved: LOCAL ONLY — not pushed, merged or deployed)

| Repo / branch | Commit | Content |
|---|---|---|
| Website `master` | `43d2358` | Checkout, payment and order confirmation |
| Website `master` | `eecc659` | Store pages, header search, footer shop links |
| Website `master` | `6bdf134` | Fix stale cart after sign-in merge; narrow-screen form labels |
| Website `master` | `99b91a0` | Checkout, outage and discovery tests (+ checkout fixtures) |
| Website `master` | (this commit) | Docs: API contract + this ledger |
| Backend `feature/customer-auth` (base `9cbe949`) | `bcf5ed9` | Customer email verification, password recovery, account security, sessions, customer emails |
| Backend `feature/customer-auth` | `0045e1d` | Opt-in `TRUSTED_PROXIES` for per-shopper rate limits |

Verification before committing: secrets/artifact scan (none); website commits 1–4 each typecheck in isolation (tsc 0 errors) and pass unit tests (196 / 196 / 196 / 210); backend commits are byte-identical to the tested tree (Authentication + Users suites 112 tests OK on 2026-10-28; full suite 3,304 OK on 2026-10-27; Pint + php -l clean). `feature/catalog-filtering` (`2cc03b7`) untouched.

## Release readiness (2026-10-28)

**Verdict: NOT READY for production launch** — the website code is complete and verified locally, but a customer cannot pay in production and the account backend is not deployed. Website-side work is done; every blocker below is backend, infrastructure, data or business.

### Mandatory launch blockers (priority order)

1. **Real payment provider (P0, external + backend).** Only the test `sandbox` driver exists and it refuses to register in production.
   - Backend: a driver implementing `Modules\Payments\Contracts\PaymentProvider` (`code`, `capabilities`, `isAvailable`, `supportsCurrency`, `initiate` → redirect URL, `verifyWebhook`, `parseWebhook`), registered in `PaymentProviderRegistry`, with config/env for credentials and webhook secret.
   - Business: merchant account and contract with a gateway supporting EGP (and other market currencies), its sandbox credentials for verification, the production webhook URL `POST /api/v1/payments/webhooks/{provider}` reachable from the gateway.
   - Admin config: payment method(s) + routes per market (`/v1/admin/payment-methods`).
   - Website: no code change expected (follows `action.url`, https only); verify end-to-end in the gateway's sandbox.
2. **Cash on Delivery decision (P0 business; backend work if chosen).** Feasible, not present. Needs: a `cod` driver (initiation with no redirect, status pending), a merchant/admin "collected on delivery" capture action that marks the payment succeeded, settlement/finance handling of cash collected, and rules (max order value, markets). Without COD or a gateway, no market can place orders (the website explains this to customers).
3. **Unpaid orders hold stock forever (P0 backend).** Order placement reserves inventory with **no expiry**, and `inventory:expire-reservations` is **not scheduled**. Abandoned unpaid orders lock stock. Needs: a reservation/payment window for unpaid orders, the scheduler entry, and an unpaid-order cancellation path (none exists for customers or admins).
4. **Order fulfilment lifecycle (P0 backend for operations).** `OrderStatus`/`StoreOrderStatus` only have `placed`: no confirmed/shipped/delivered/cancelled, so merchants can't progress orders and customers see "Placed" forever (the website already renders those statuses when they exist).
5. **Deploy `feature/customer-auth` (P0).** Merge/review, run migration `2026_10_27_000100_create_user_email_verification_tokens_table`, set `STOREFRONT_URL` (production storefront origin, https) and `TRUSTED_PROXIES` (storefront egress IPs), configure a production mail transport (SMTP/SES/…) and verify SPF/DKIM so verification and reset emails arrive. Until then staging returns 404 for verify/reset/sessions.
6. **Deploy latest catalog backend (P1) — BR-3.** Staging lacks `90d705e` (self-excluding price bounds; the only staging-specific E2E skip).
7. **Egyptian geography data (P0 data).** Staging has 1 region for Egypt. Need the governorates (27) with their cities/districts, bilingual names, plus delivery zones/rates per store covering them (merchant config), the market tax rule, and a commission rule (orders fail without one).
8. **Legal & policy content (P0 business).** Approved Terms, Privacy, Returns/Refunds, Shipping, and contact details; the website deliberately shows none it doesn't have. A CMS/static endpoint or approved static copy is needed; then pages + footer links.
9. **Production verification gates (P0).** On a production-like environment: full E2E (auth, checkout with the real gateway's sandbox, webhook delivery), mail deliverability, `SITE_INDEXABLE=true` only on production + SEO crawl, load/latency of the BFF → API path, monitoring/alerting for 5xx and webhook failures, backups.

### Should fix soon after launch (P1)
- **BR-1:** a parent category with `include_descendants` returns **no** attribute facets (verified 2026-10-28 on catalog-filtering HEAD and staging: Fashion → none; its leaves → color, size, material, shoe size). Filters only appear on leaf categories.
- Customer order cancellation / returns requests (no endpoints).
- Customer avatar upload UI (API exists; not built).

### Optional post-launch features (no backend support today)
Newsletter, coupons/discount codes, product reviews/ratings, order tracking numbers/carrier integration, guest checkout, phone login/SMS verification, wishlist sharing.
