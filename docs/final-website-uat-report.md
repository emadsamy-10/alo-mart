# ALO MART website — final UAT report

Date: 2026-11-07. Website `E:\workspace\alo-mart\alo-mart-website`, branch `feature/navbar-and-customer-journey` @ `aa0502d`
plus the uncommitted fixes listed below. Backend under test: `E:\workspace\alo-mart\worktrees\staging-candidate` (local only).

**Recommendation: CONDITIONAL PASS** (see section 11).

## Environment

| Part | What was used |
|---|---|
| Website | Production build (`npm run build`) served by `next start` on port 3100 |
| API | The staging-candidate backend on `php -S` (single-threaded), behind a small Node proxy |
| Data | Disposable SQLite database; synthetic customers created per test |
| Email | Log transport only (links read from the Laravel log) |
| Payments | Sandbox driver; results delivered as signed sandbox webhooks |
| Staging / production | Not touched. Nothing pushed, merged or deployed. No real payments |

## 1. Pages discovered and tested

- **25 page routes** under `src/app/[locale]`, plus `robots.txt`, `sitemap.xml`, the localized 404 and the error boundary.
- **No contact, legal or informational pages exist.** Neither the website nor the API has them, and the footer links only to
  real pages (shop and account sections). They are recorded as *unavailable functionality*, not defects.
- **Browser sweep:** 32 route variants (22 public, 10 signed-in) × 16 viewport combinations = **512 real page loads**.
  - Widths: 1920, 1440, 1024, 768, 390 and 320.
  - Arabic and English at every width.
  - Dark theme at 1440 and 390, in both languages.
  - Route variants include sort/offer/search listings, an empty search, category and subcategory, brand, store, empty
    cart and wishlist, every auth page, every account page, cart, checkout and a placed order.

## 2. Coverage matrix

| Area | Status | Evidence |
|---|---|---|
| Homepage, hero carousel, sections | Tested, passed | storefront.spec, redesign.spec (hero arrows and dots), sweep |
| Header, navbar, mega menu, sticky header | Tested, passed | redesign.spec, sweep at 6 widths, navbar evidence |
| All products, filters, sort, search, pagination, URL state | Tested, passed | catalog.spec (20 tests), shopping.spec, journey 70 |
| Categories and subcategories | Tested, passed | catalog BR-1 tests, discovery guest journey, sweep |
| Stores and brands (directories and pages) | Tested, passed | discovery.spec, redesign.spec, sweep |
| New arrivals, best sellers, offers | Tested, passed | nav-link test (real pages), API sort check, on-sale filter test |
| Product details: gallery, zoom, variants, stock | Tested, passed | shopping.spec, journey 70, test 75 |
| Login, logout, sessions, open redirects | Tested, passed | auth 06–13 |
| Registration and email verification | Tested, passed | auth 01–05, 19–22 |
| Forgot, reset and change password | Tested, passed | auth 14–18, account 25–26 |
| Profile, email and mobile change, devices | Tested, passed | account 23–30 |
| Addresses: create, edit, default, delete | Tested, passed | account 31–35 |
| Wishlist and cart (guest, account, merge, markets) | Tested, passed | shop 39–41, shopping.spec, new test 84 |
| Session expiry and unauthorized access | Partly tested | Revocation, deactivation and 401 handling tested (11, 13). Natural token expiry was not waited out |
| Checkout, shipping and tax | Tested, passed | journey 70 (UI totals match the quote API), checkout 52 |
| Successful and refused orders | Tested, passed | journey 70–83, checkout 48–51, 60 |
| Payment pending, failed and paid states | Tested, passed | 49 (failed), 54 (pending), 56 (late payment refund), journey 70 (paid) |
| Hosted sandbox payment page | **Not exercised** | Only the "continue to payment" link is checked. Success arrives by signed webhook |
| Order details and history, cancel, expiry, stock | Tested, passed | 36–38, 54–57, journey 70 with database checks |
| Double submit, retries, network failure | Tested, passed | 50, 78, 79, 81, 83, outage 53 |
| Error, empty and loading states | Tested, passed | outage 53, empty states in the sweep, catalog `aria-busy`, 404 tests |
| Footer links and redirects | Tested, passed | discovery footer test, root redirect, language switch |
| Contact, legal and informational pages | Unavailable | They do not exist in the product |
| Tablet (768) shopping journey | Partly tested | Every page rendered and measured at 768; no purchase was driven at 768 |
| Lighthouse scores | Not measured | No Lighthouse run. Web-vitals signals measured in the browser instead |

## 3. Test results

| Gate (final code) | Exit | Result |
|---|---|---|
| TypeScript (`tsc --noEmit`) | 0 | Clean |
| ESLint | 0 | Clean |
| Unit tests (vitest) | 0 | 229 of 229 passed (was 227; +2 for shop state) |
| Production build | 0 | Succeeded |
| Full Playwright, one worker | 0 | **168 passed, 0 failed, 94 skipped** (13.0 min) |
| Outage spec (`E2E_OUTAGE=1`, separate) | 0 | 1 of 1 passed |
| UAT browser sweep | 0 | 512 loads; findings in section 4 |

**The 94 skips are all intentional device scoping.** None hides a failure:

- **84 in the mobile project.** These flows run on desktop only (auth, account, checkout, lifecycle, journey) or are
  desktop-only shell tests. Their phone counterparts run separately.
- **10 in the desktop project.** Nine are phone-only tests: journeys 72 and 73, the mobile menu drawer, the mobile filter
  sheet, bottom navigation (2), the sticky mobile bar, the mobile bottom sheet and the new test 84. The tenth is the
  outage spec, which kills the API and is run on its own (1/1 passed).

**Coverage gaps the skips do not explain:** natural session expiry, the hosted sandbox payment page and a purchase driven
at 768px are not covered. They are listed in the matrix above.

## 4. Bugs found and fixed

All defects found are P2. No P0 or P1 defect was found. Each fix was reproduced first and then verified in the browser on a
production build.

| # | Defect | Sev. | Cause | Fix | Regression proof |
|---|---|---|---|---|---|
| 1 | A signed-in shopper's cart page showed **"Your cart is empty"** (and the wishlist "No saved products yet") before their account items appeared. This also caused a layout shift of 0.06–0.08 on phones | P2 | The stores start with this device's guest items while the account lists load after hydration | Track when the account sync has finished and show a placeholder until then, sized from the server-side session: about an empty cart for guests, a one-line cart for signed-in visitors | Test 84 failed on the old build ("Your cart is empty" recorded) and passes now. Unit `shop-state.test.ts`. Cart CLS measured at **0** at 320, 390 and 1440 for guests and signed-in visitors (test 84 asserts < 0.1) |
| 2 | Signed-in cart said "saved in this browser… not linked to an account"; an empty signed-in wishlist said products "stay on this device" | P2 | Guest copy shown to everyone | Account wording (Arabic and English) when signed in | Test 84; after-fix screenshots |
| 3 | The sitemap listed only Arabic URLs as `<loc>`; English pages appeared only as alternates | P2 SEO | One entry per path, using the default locale | One entry per language version, each with its hreflang alternates (116 → 232 URLs) | storefront sitemap test now requires `/en` locs |
| 4 | The 404 page used the homepage title, in the HTML and in the browser tab | P2 SEO | not-found had no metadata, and Next re-applies the layout title on the client | Not-found metadata for the HTML, plus a small client component that keeps the title after hydration | storefront 404 test checks both titles. Browser title verified for an unknown path and an unknown product |
| 5 | Accessible names hid visible text (WCAG 2.5.3) on: market switchers, language link, Arabic logo, account menu and sign-in link, bottom-nav cart and wishlist, and "View more" section links | P2 a11y | `aria-label` overrode the visible label | The visible text is now the name, with context in screen-reader-only text. Count badges are `aria-hidden` | axe re-run on the fixed build (section 7) |
| 6 | Two unnamed search landmarks on catalog pages | P2 a11y | Header search and catalog search both `role="search"` | Distinct `aria-label`s | axe: clean |
| 7 | Utility bar content outside every landmark | P2 a11y | Plain `div` | Named region (`section aria-label`) | axe: clean |
| 8 | "This device" badge contrast 4.45:1 (needs 4.5:1) | P2 a11y | `text-success` on `bg-success-soft` | Body text colour on the success tint | axe: clean |

Also from the previous task, already in the branch: lost-connection handling at checkout and the confirmation wording.

## 5. Remaining defects

| Item | Severity | Notes |
|---|---|---|
| axe flags the Arabic **header** cart icon (`فتح السلة، منتج واحد`) | P2, accepted | axe still counts the `aria-hidden` badge digit "1" as visible text. Arabic writes one item without a digit, and forcing one would read worse for screen-reader users. English passes |
| The "account unavailable" error state has no `h1` | P2 | Only shown when the account API fails. The page title stays correct |
| Prefetch requests are cancelled and re-issued on hydration | Info | Next.js link-prefetch behaviour, not a defect. No duplicate API calls were found in the sweep |
| Local API timeouts under sweep load (one 500 on best sellers, one "account unavailable") | Environment | Single-threaded `php -S` queued requests (about 0.3 s each when idle). The site showed its honest error states. Not reproducible when the API is idle |

## 6. Responsive and visual results

- **No horizontal overflow on any of the 512 loads**, from 1920 down to 320, Arabic and English, light and dark.
- **No broken images** (checked again after scrolling for lazy images) and **no image without `alt`**.
- Contact sheets reviewed at 320 Arabic, 390 dark English and Arabic, 768 Arabic, 1024 English, 1440 dark Arabic and 1920
  English. They show no overlaps, clipping, misplaced dropdowns or broken states.
- On phones, account tabs scroll horizontally by design.
- Navbar states (open, hover, focus, sticky, after navigation) were verified in the previous task, and its evidence
  still applies.

## 7. SEO and accessibility findings

**SEO, every public route** (title, description, canonical, three hreflang alternates, Open Graph): present everywhere.

- **Canonicals:** filtered, sorted and search listings point to `/products`; product, category, brand and store pages point
  to themselves.
- **noindex:** every page is `noindex, nofollow` locally because `SITE_INDEXABLE` is not `true`. This is the safe default
  for non-production. Personal pages (cart, checkout, account) are `noindex` by design.
- **Structured data:** Product JSON-LD with an EGP offer and no fabricated rating (covered by tests). BreadcrumbList is on
  listings, categories, brands and stores.
- **Sitemap and robots:**
  - The sitemap now lists both languages.
  - `robots.txt` blocks everything outside production.
  - Locally the sitemap showed host `localhost:3000`. That came from an ISR cache regenerated by a server without
    `SITE_URL`, not from code. Production must set `SITE_URL`.

**Accessibility (axe-core 4.14.0, all rules, on the fixed build).** Clean on:

- home in English and Arabic at 1440,
- products and a product page at 1440,
- home at 390 dark (English) and 320 (Arabic),
- account security, checkout and cart in English,
- wishlist at 390.

The only remaining hit is section 5's accepted Arabic header cart icon. Heading order and `h1` counts were checked on
every load: exactly one `h1`, no skipped levels, apart from the API-error state noted in section 5. Keyboard and focus
behaviour are covered by tests 47 and the navbar focus checks.

**Performance (measured in the browser):**

- Layout shift is ≤ 0.015 on every page except the signed-in cart, which is now 0.
- LCP is about 1–3 s locally when the API is idle. Outliers of 11–20 s happened only during the API queueing above.
- Images go through `/_next/image`. No oversized images were flagged beyond 2.5× the rendered size.
- **No Lighthouse score is claimed.**

## 8. Payment and order verification

The full journey (test 70, final run) placed order **`AM-261107-8D5GKE`** (`807c0989-0b78-4957-9095-58d35c1621f3`),
checked independently in the database:

- **Order:** exactly 1 order for the customer, status `confirmed`, payment `paid`.
- **Item:** variant 49, quantity 2, at EGP 449.
- **Totals:** shipping EGP 50, VAT included EGP 116.42, total EGP 948, commission EGP 78.77.
- **Stock:**

  | Stage | On hand | Reserved |
  |---|---|---|
  | Before the order | 503 | 3 |
  | After placing | 503 | 5 |
  | After payment | 501 | 3 |

- **Reservation and payment:** the reservation went from `active` to `consumed`. One payment record, `succeeded`,
  EGP 948.

**What "paid" proves here:** the payment success came from a signed sandbox provider webhook. The hosted sandbox payment
page was **not** exercised and remains unverified. No real payment, refund or payout was made.

## 9. Evidence

- **Sweep (before fixes):** `E:\workspace\alo-mart\redesign-evidence\uat\` contains:
  - `shots-before-fixes\` (512 screenshots),
  - `contact-sheets\`,
  - `sweep-before-fixes.json` (per-load metrics),
  - the sweep and probe scripts.
- **After fixes:** `E:\workspace\alo-mart\redesign-evidence\uat\after-fixes\` (signed-in cart in English and Arabic dark,
  404, security badge, home at 320).
- **Journey screenshots and order evidence:** `E:\workspace\alo-mart\redesign-evidence\uat-journey\`.
- **Progress ledger:** `docs/final-website-uat-progress.md`.

## 10. Git status

Branch `feature/navbar-and-customer-journey` @ `aa0502d` (local; `master` = `origin/master` = `56f29a9`). Nothing
committed, pushed, merged or deployed for this task.

- **Modified:**
  - Messages: `messages/ar.json`, `messages/en.json`.
  - App routes: `src/app/[locale]/cart/page.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/sitemap.ts`.
  - Layout: `BottomNav`, `HeaderSearch`, `LanguageSwitcher`, `Logo`, `MarketSwitcher`, `SiteHeader`.
  - Shared: `SectionHeading`.
  - Account: `AccountShopSync`, `shop-state`, `AccountForms`, `AccountMenu`.
  - Cart and wishlist: `CartPageView`, `HeaderShopButtons`, `WishlistPageView`.
  - Catalog: `CatalogSearch`.
  - Tests: `tests/e2e/account/shop.spec.ts`, `tests/e2e/storefront.spec.ts`.
- **New:** `src/components/shared/DocumentTitle.tsx`, `tests/unit/shop-state.test.ts`,
  `docs/final-website-uat-progress.md`, this report.

The QA scripts live in the git-ignored `qa/` folder.

## 11. Recommendation: CONDITIONAL PASS

**Why it passes:**

- No P0 or P1 defect was found.
- Every P2 found was fixed with a regression test, except the one documented a11y heuristic and the API-error heading.
- All gates are green on the final code.
- A real customer reaches a correct, paid order.

**Conditions before calling it production-ready:**

1. Exercise the hosted sandbox payment page through the provider's supported sandbox. It is not verified here.
2. Deploy the backend features this site needs to staging. When last checked, staging did not have auth or the order
   lifecycle.
3. Repeat the journey there. This run used SQLite and `php -S`, not MariaDB or a production-like server.
4. Set `SITE_URL` and `SITE_INDEXABLE=true` only for production. Check the live sitemap host and robots.
