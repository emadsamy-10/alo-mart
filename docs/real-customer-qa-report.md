# ALO MART — real-customer QA report (2026-11-10)

**Recommendation: CONDITIONAL PASS** (see §11). Nothing committed, pushed, merged or deployed. Staging and production untouched.

## 1. Environment (isolated)
- Website: production build (`next start -p 3100`) of `alo-mart-website` (branch `feature/navbar-and-customer-journey` @ `2b60d66` + uncommitted work).
- Backend: candidate worktree `E:\workspace\alo-mart\worktrees\staging-candidate` (`f10e5ff`, unchanged) served by 3 `php -S` workers behind a local proxy (`127.0.0.1:8098`).
- Database: disposable MariaDB 10.4.32 database **`alo_mart_zz_rcqa`** (created for this QA; migrated with the candidate; demo catalog copied read-only from the earlier SQLite runtime). The runtime refuses any other database.
- Admin Dashboard: real app (`alo-mart-admin-dashboard`, Vite on :5180) pointed at the same local API via an environment override (its `.env` not edited).
- Mail: Laravel `log` transport (captured, never sent); mail-failure tested with SMTP to a closed port. Payments: sandbox driver, HMAC-signed webhooks only.

## 2. Customer journeys actually exercised in the browser (Playwright MCP)
| Journey | Result |
|---|---|
| Registration (validation, mismatch), immediate sign-in unverified (en, ar) | Works |
| Unverified customer browses, wishlists, adds to cart; checkout explains verification; Place order refused (403) — no order, no hold in DB; cart and address kept | Works (after BUG-001…003) |
| Resend + cooldown; invalid / malformed / superseded / current / reused links; API outage during confirmation; mail transport down; email change → re-verification; direct API order while unverified → 403 | Works (after BUG-004…006) |
| Verified customer: checkout → order AM-261110-6WG6AT (EGP 1,397 incl. VAT 171.56) → sandbox failed → retry → succeeded → confirmed/paid; duplicate event refused | Works |
| Customer cancels an unpaid order (AM-261110-5XK3TJ): inline confirm → cancelled, holds released | Works |
| Account isolation: sign out → guest → sign in as another customer; other customer's order URL → 404; duplicated tabs + account switch | Isolated (DB checked) |
| Forgot/reset password, show-password, wrong password, revoked session → sign-in with `next` (ar) | Works |
| Search en/ar/partial/none; filters (size + in stock) checked against the API; Back/Forward keeps filters | Works |
| Addresses: add, default, edit; **Admin creates a city → customer address form + checkout** | Works (after BUG-007) |
| Product page: wishlist save/remove + Add to cart + leave immediately | Works (after BUG-008) |
| Homepage sections, brand and store pages at 320/390/768, en/ar; dark mode (ar 390); keyboard (skip link, mega menu, mobile menu, cart drawer) | Works (after BUG-009, BUG-010) |

## 3. Email-verification behaviour (verified)
Register → signed in immediately → can browse, search, filter, wishlist, cart → reminder on the account page says a confirmed email is needed **to place orders** → checkout shows "Verify your email to place your order" (also before an address exists) with a working resend (cooldown, delivery-failure message) → Place order refused by the backend (UI and direct API) with cart/address kept → captured link confirms the address in the same session → checkout continues, order placed. Malformed, superseded, expired, reused links and outages all leave a way forward; an email change requires confirming again.

## 4. Bugs found and fixed
| ID | Sev | Area | Defect | Fix | Regression test |
|---|---|---|---|---|---|
| BUG-001 | P2 | Account | Reminder never said confirmation is needed to place orders | Copy en/ar | e2e 85 |
| BUG-002 | P2 | Checkout | Unverified + no address: no verification notice | Notice on the no-address state | e2e 86 |
| BUG-003 | P2 | Checkout | Resend button overflowed the notice; copy claimed an address was saved | Layout + copy | e2e 87 |
| BUG-004 | P2 | /verify-email | Malformed/missing link: dead end | Invalid outcome with resend / sign-in | e2e 88 |
| BUG-005 | P2 | /verify-email | Reused link while verified: "invalid" + "already verified" together | "Already confirmed", token untouched | e2e 89 |
| BUG-006 | P2 | Mail | "We sent a link" shown when mail delivery failed | Truthful landing/resend/email-change messages | unit `verification-mail`, e2e 90 |
| **BUG-007** | **P1 ops / P2 shopper** | Geography | **City created in Admin missing from the address form** (renamed/deactivated cities also stale) | Website geography no longer cached (see §5) | e2e 91 |
| **BUG-008** | **P2** | Cart | **Signed-in Add to cart lost when leaving the page right after (journey test 70)** | Keep-alive, ordered write batches (see §6) | e2e 92, 93; journey 70 |
| BUG-009 | P3 | Store/brand/category | Long Arabic H1 overflowed 4 px at 305 px | Smaller H1 below 360 px + `break-words` | storefront test |
| BUG-010 | P2 (a11y) | Cart drawer | Escape dropped focus to `<body>` | Focus returns to the opener | shopping test |
| OBS-01 | P3 | PDP | Option groups read "ColorWhite" | One sr-only legend string "Color: White" | shopping test |
| OBS-02 | P3 | Order details | "Tax" for an amount already in the total | "Includes tax" / "شامل الضريبة" | account test 37 |

## 5. BUG-007 — new city not offered in the address form
- **Trace:** Admin form → `POST /admin/cities` (CityService; `is_active` defaults to true) → `cities` row 11 "Sheikh Zayed QA", region 2 (Giza), country 1, active → public `GET /regions/2/cities` returned "Dokki, Sheikh Zayed QA, 6th of October" **immediately** (no backend cache, no pagination, active-only filter) → website dropdown after a full reload: **"Dokki, 6th of October"**.
- **Root cause (website):** `src/features/account/api.ts` read countries/regions/cities with `revalidate: 3600` — Next.js's shared server data cache. Nothing invalidated the `geography` tag (the Admin Dashboard is a separate app), so new/renamed cities appeared up to an hour late and deactivated cities stayed selectable (then refused on save).
- **Not an environment mismatch:** the Admin Dashboard and the website `.env` both point at the same API (staging); locally both used 127.0.0.1:8098.
- **Fix:** `revalidate: 0` for the three geography reads (address screens only; small lists). No backend, Admin or schema change; IDs and saved addresses untouched.
- **After:** created → listed under Giza only (not Cairo) → saved address 342 with `city_id` 11 → Checkout → Add address → listed after refresh → deactivated in Admin → gone from new addresses while address 342 still shows its city in Edit → reactivated. Test 91 failed before, passes ×2 after.

## 6. BUG-008 / test 70 — cart item missing after Add to cart
- **Evidence:** test 70 trace — the product page's server actions ran one at a time (Next.js action queue); the account load took 2.0 s, the next action started at 39.66 s and was aborted (status −1) by `goto('/en/cart')` at 39.89 s, with the wishlist remove and the cart add still queued. DB: the shopper had **0 cart items** and 0 wishlist rows; the header had shown "1" from optimistic local state.
- **Classification:** (1) the mutation was never sent / was cancelled — yes; (2) persisted but stale — no; (3) overwritten by sync — no; (4) wrong empty state — no (it showed the real, empty account); (5) the test's immediate navigation is legitimate customer behaviour, not a test error.
- **Fix (website only):** account cart/wishlist **writes** go through `shop-writes.ts` (client queue: one request in flight, later writes batched in order, keep-alive requests, `pagehide` flush) → new route `src/app/[locale]/shop-sync/route.ts` (same-origin JSON only; batch applied in order) → `shop-core.ts` (the former action bodies, unchanged). `session-order.ts` orders each shopper's operations per session in the server process, and the remaining server actions (loads, sign-in merge) go through it, so the next page's account load waits for writes still being applied.
- **Verification:** new test 92 (exact test-70 sequence; checks the page AND the account via API) failed before, passes; 92/93 ×3 = 6/6; journey test 70 ×3 = 3/3; browser: same sequence as a real customer → item in the account (DB), wishlist empty. Endpoint: no/foreign Origin 403, non-JSON 415, GET 405, signed-out request → `signedOut`, no change.
- **Account switch (found in the closing review, fixed):** a tab still showing customer A, after A signed out and B signed in from another tab, wrote its Add to cart into **B's** cart (proven: B's account had the item). Each page now carries a one-way fingerprint of its session (`<body data-session>`); every write sends it and the route refuses a mismatch as `signedOut`, so the stale tab reloads into the current session. Test 94 failed before (B had 1 item), passes after (×3 with 92/93: 6/6 + the auth and shop specs).
- **Review:** CSRF — same-origin `Origin` + JSON only (cross-site needs a preflight the route does not allow; cookie is `SameSite=Lax`). Authorization — the backend checks every write against the session's own account. Duplicate writes — the `pagehide` flush sends only never-sent writes; no retries.
- **Deployment limit (open condition):** the per-session ordering lives in one Node.js process. The repository has no multi-process/replica configuration (`next start`, single process; runbook: "the host's process manager runs `npm run start`"), so the shipped setup is single-process. If staging/production runs several processes or replicas, writes flushed while leaving a page with a batch still in flight could be applied out of order on two instances, and the next page could briefly show the cart before them. Account isolation and CSRF do not depend on it. Confirm the hosting model before relying on it; multi-instance needs a shared lock (e.g. Redis) or sticky sessions.

## 7. Real orders and payments (isolated DB)
| Order | Flow | Final status | Stock |
|---|---|---|---|
| AM-261110-6WG6AT (id 155) | verified customer, sandbox `failed` → retry → `succeeded` | confirmed / paid, payment succeeded 1,397.00, one webhook row | holds consumed, on-hand −1 per variant |
| AM-261110-5XK3TJ (id 181) | placed, then cancelled by the customer | cancelled / unpaid, `customer_requested` | 2 holds released |
| Unverified attempts (UI + direct API) | refused 403 `email_unverified` | no order | no hold |

**Blocked by missing infrastructure:** the hosted payment page — the sandbox driver redirects to `checkout.sandbox-payments.invalid` (deliberately unresolvable). Payment results were exercised only through correctly signed sandbox webhooks; no real gateway, no real money.

## 8. Language, responsive, accessibility
- en/ar, LTR/RTL across all journeys above; dark mode (ar 390); 320/390/768/1024/1440 spot checks: no horizontal scroll after BUG-009.
- Keyboard: skip link first in order; mega menu and mobile menu open/close by keyboard with focus returned; cart drawer focus return fixed (BUG-010); visible 2 px focus ring.

## 9. Test results (final code, MariaDB runtime, run sequentially)
| Gate | Result |
|---|---|
| TypeScript | exit 0 |
| ESLint | exit 0 |
| Unit (vitest) | 231 / 231 passed (22 files) |
| Production build | exit 0 |
| **Full Playwright, once, 1 worker** | **179 passed, 1 failed, 106 skipped** (12.1 min; 286 tests; desktop + mobile projects; skips are the per-project device splits and the separately-run outage spec) |
| The 1 failure | account test 31 — a **test assumption**, not a defect: it hard-coded Giza's cities as "Dokki, 6th of October"; the QA city "Sheikh Zayed QA" (id 11, active, used by address 342) correctly appeared. The test now asserts the dropdown equals the public API's live list for Giza (stricter). Rerun: passed. |
| Repeats | journey test 70 ×3 passed; cart-sync 92/93 ×3 = 6/6; geography 91 ×2 passed |
| After the account-switch fix (targeted, not a full run) | cart-sync 92–94 ×2 = 6/6; auth + shop specs 35 passed; journey 70 passed; account 31 passed; unit 231/231 |

The full run above is **not** fully green: it had 1 failure (test 31), corrected and passed afterwards on its own. The full suite was not rerun after the final edits.

New regression tests: e2e 85–93 (`verification-ux`, `geography`, `cart-sync`), shopping (focus return, option-group name), storefront (narrow Arabic headers), account 37 assertion; unit `verification-mail.test.ts`. The outage spec (`E2E_OUTAGE=1`) was not part of this run.

## 10. Remaining issues
| Sev | Issue |
|---|---|
| Blocker for real payments | No real payment gateway / hosted page (by design, out of scope). |
| P3 | `/verify-email` "Confirming…" can take a few seconds while the account lists load first (server actions run one at a time). |
| P3 | Header cart badge briefly shows the guest count on a fresh page before the account cart arrives. |
| P3 | Stale tab after an account switch shows the backend's raw "Cart item not found." (data is safe). |
| P3 | Backend: resend cooldown also applies after a failed delivery (token row written before sending). |
| P3 | Skip link moves the reading position but leaves focus on `<body>`. |
| Env | Store cover image file missing in the QA demo data (404 image requests on the store page). |

## 11. Recommendation
**CONDITIONAL PASS** for the supported journey (Browse → Cart → Checkout → Place Order → pending/paid status via sandbox), with all P1/P2 defects found in this QA fixed and covered by regression tests. Conditions: the real payment gateway/hosted page, and repeating the journey on staging after the backend candidate is deployed.

## 12. Files and Git status
Branch `feature/navbar-and-customer-journey` @ `2b60d66`; **nothing committed**.
- **Alexandria font change (separate, earlier):** `src/lib/fonts.ts`, `src/app/globals.css`, `src/app/[locale]/layout.tsx`, `src/app/not-found.tsx`, `src/app/global-error.tsx`, `src/components/layout/BottomNav.tsx`, `src/features/cart/CartLines.tsx`, `src/features/catalog/PriceRangeFilter.tsx`, `src/features/homepage/Hero.tsx`, `docs/design-audit.md`, `.claude/skills/luxury-ui/SKILL.md`, `.claude/skills/luxury-ui/references/approved-desktop.md`, and the Add-to-cart width hunk in `src/features/products/purchase/PurchasePanel.tsx`.
- **This QA:** `messages/en.json`, `messages/ar.json`, `src/app/[locale]/account/page.tsx`, `src/app/[locale]/checkout/page.tsx`, `src/app/[locale]/verify-email/page.tsx`, `src/app/[locale]/stores/[slug]/page.tsx`, `src/app/[locale]/brands/[slug]/page.tsx`, `src/app/[locale]/categories/[slug]/page.tsx`, `src/app/[locale]/shop-sync/route.ts` (new), `src/features/account/actions.ts`, `api.ts`, `geo-actions.ts`, `redirect.ts`, `shop-actions.ts`, `shop-core.ts` (new), `session-order.ts` (new), `shop-writes.ts` (new), `ui/VerifyEmail.tsx`, `src/features/cart/store.ts`, `CartDrawer.tsx`, `src/features/wishlist/store.ts`, `src/features/checkout/ui/VerifyEmailNotice.tsx`, the legend hunk in `src/features/products/purchase/PurchasePanel.tsx`; tests `tests/e2e/account/verification-ux.spec.ts`, `geography.spec.ts`, `cart-sync.spec.ts` (new), `tests/e2e/account/account.spec.ts`, `tests/e2e/shopping.spec.ts`, `tests/e2e/storefront.spec.ts`, `tests/unit/verification-mail.test.ts` (new), `tests/unit/shopping-ui.test.tsx`; docs `docs/real-customer-qa-progress.md`, this report.
- `PurchasePanel.tsx` holds one hunk of each change: commit by hunk to keep them apart.
- Backend candidate, main backend (`E:\xampp\htdocs\alo-mart`) and Admin Dashboard: no source changes.
