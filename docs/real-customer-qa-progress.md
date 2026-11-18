# Real-customer QA — progress ledger

Started 2026-11-10. Resume from here after an interruption; don't redo ticked items. **Nothing committed.**

## Baseline (before this task)
- Website branch `feature/navbar-and-customer-journey` @ `2b60d66`, with the **uncommitted Alexandria font change**
  (13 files: `src/lib/fonts.ts`, `globals.css`, `[locale]/layout.tsx`, `not-found.tsx`, `global-error.tsx`, `BottomNav.tsx`,
  `CartLines.tsx`, `PriceRangeFilter.tsx`, `Hero.tsx`, `PurchasePanel.tsx`, `docs/design-audit.md`, `.claude/skills/luxury-ui/*` x2).
  QA changes below are listed separately so the two can be committed apart.
- Backend candidate `E:\workspace\alo-mart\worktrees\staging-candidate` `feature/staging-candidate` @ `f10e5ff`, clean.
- Main backend `E:\xampp\htdocs\alo-mart` `feature/catalog-filtering`, clean. Not used.

## Isolated environment
- MariaDB 10.4.32 (XAMPP), started by this task (`mysqld --standalone`); stop it at the end. Disposable DB **`alo_mart_zz_rcqa`**
  (created new; did not exist). Migrated with the candidate (98 tables), then the demo dataset copied read-only from a copy of
  the earlier SQLite runtime (`rcqa/copy-from-sqlite.php`, 4,868 rows).
- Runtime folder (session scratchpad) `rcqa/`: `boot.php` refuses any DB other than `alo_mart_zz_rcqa` on 127.0.0.1 and the real
  backend checkout. 3 `php -S` workers (8101–8103) behind `node front.mjs 8098`. Mail: `log` → candidate `storage/logs/laravel.log`.
  Sandbox payments with a local secret. `CACHE_STORE=database`.
- Website: `next start -p 3100` (production build, `ALO_API_BASE_URL=http://127.0.0.1:8098/api/v1`).

## Journeys
- [ ] A First-time visitor
- [~] B Registration and authentication — done: register (validation, mismatch), auto sign-in unverified, resend + cooldown,
      invalid / superseded / current / reused links, verified state. To do: forgot/reset, change password, change email
      (re-verification), mail failure, API timeout, wrong credentials, two tabs.
- [ ] C Customer account
- [ ] D Product discovery
- [~] E Product details and cart — variants, wishlist, add, View cart, reload 30 ms after add (item kept on MariaDB).
- [x] F Checkout and order placement — unverified: notice, Place order refused (403), no order/reservation in DB, cart and
      address kept. Verified: order **AM-261110-6WG6AT** (id 155) placed/unpaid, 3 active holds, cart emptied.
- [~] Payments (sandbox): signed `failed` → "didn't go through, nothing charged", retry → new attempt; signed `succeeded` →
      confirmed/paid, holds consumed, on-hand −1 each; same event id with different content → 409, one webhook row.
      Hosted payment page: the driver redirects to `checkout.sandbox-payments.invalid` (no page exists) — BLOCKED by design.
- [ ] Responsive / language / accessibility spot checks
- [ ] Final gates and report

## Bug register
| ID | Sev | Journey / page | Summary | Status |
|---|---|---|---|---|
| BUG-001 | P2 | Account overview | Unverified reminder said the link "keeps your account secure and lets you reset your password"; never that a confirmed email is needed to place orders. | Fixed (copy en/ar); test 85 |
| BUG-002 | P2 | Checkout, no address | Unverified customer without an address saw only "Add a delivery address first"; learned about verification only after adding one. | Fixed (`checkout/page.tsx` shows the notice); test 86 |
| BUG-003 | P2 | Checkout notice | "Send a new confirmation link" overflowed the notice at 1440 (fixed 15rem column). Notice copy also claimed "address saved" with no address. | Fixed (`VerifyEmailNotice.tsx`, copy); test 87 |
| BUG-004 | P2 | /verify-email | Malformed/missing token: "Request a new link" with no button or link (dead end). | Fixed (page renders the invalid outcome with resend / sign-in); test 88 |
| BUG-005 | P2 | /verify-email | Reopening a used link while signed in and verified: "This link is not valid… request a new link" plus a resend that answers "already verified". | Fixed (page shows "Already confirmed", token untouched); test 89 |
| OBS-01 | P3 | PDP | Variant groups named "ColorWhite" / "SizeS" (label and value run together for screen readers). | Open |
| OBS-02 | P3 | Order details | Summary says "Tax 171.56" while checkout says "Includes VAT 171.56"; reads as if added. | Open |
| OBS-03 | P3 | /verify-email | "Confirming…" takes ~5 s: Next runs server actions one at a time and the account cart/wishlist loads go first. | Open |
| OBS-04 | P3 | Header | Cart badge briefly shows the guest count on a fresh page before the account cart arrives. | Open |

Regression run after fixes: verification-ux (5) + auth (22) + order-verification (2) = 29 passed.

| BUG-006 | P2 | Register / resend / email change | Mail transport down: site still said "We sent a confirmation link"; resend said "Something went wrong". Backend already reported `verification_email_sent:false` / `mail_delivery_failed`. | Fixed (`afterRegister`, `?welcome=unsent`, `verify.notSent`, `emailChangedUnsent`); unit `verification-mail.test.ts` + test 90; verified in browser with SMTP to a closed port |
| OBS-01 | P3 | PDP option groups "ColorWhite" | Fix written (sr-only ": " in `PurchasePanel.tsx`) + test in `shopping.spec.ts` — **NOT YET BUILT OR RUN** |
| OBS-02 | P3 | Order details "Tax" | Label → "Includes tax" / "شامل الضريبة" + assertion in account test 37 — **NOT YET BUILT OR RUN** |
| OBS-05 | P3 | Stale tab after account switch | Shows raw "Cart item not found." (data safe: backend refused, both carts unchanged in DB) | Open |
| OBS-06 | P3 | Resend after a failed send | Backend cooldown applies although nothing was delivered (token row written before sending) | Open, backend |

## Verified since (browser, MariaDB)
- Email change → unverified again → checkout notice + direct API order 403 `email_unverified` (orders still 1) → new link → checkout open.
- Mail failure (workers with SMTP to 127.0.0.1:1), API outage during a pending link (error outcome, token survives, verifies after restore), Arabic.
- Data isolation: sign out → guest add → sign in as other customer: carts/addresses/wishlist/orders isolated (DB checked); other
  customer's order URL → 404. Duplicated tabs + account switch: stale write refused, both carts unchanged.
- Forgot/reset password, show-password, wrong password message, revoked session → sign-in with `next` (Arabic).
- Search en/ar/partial/no-results; filters (size 40 + in stock) checked against API; Back restores URL and filters.
- Addresses: add (Alexandria, default), checkout shows both, totals 449+50=499 VAT 61.28.

## BUG-007 (P1 for operations, P2 for shoppers) — new city from the Admin Dashboard missing in the address form — FIXED
- Trace: Admin `POST /admin/cities` (CityService; `is_active` defaults true) → `cities` row (region/country correct) → public
  `GET /regions/{id}/cities` (no cache, no pagination, active only) returned it AT ONCE → website `getCities()` served the OLD list.
- Root cause: website `src/features/account/api.ts` fetched countries/regions/cities with `revalidate: 3600` (Next data cache,
  shared by all visitors, tag `geography` never revalidated — the Admin Dashboard is a separate app). New/renamed cities missed
  for up to 1 h; deactivated cities stayed selectable (refused on save). Admin and website use the SAME API (both `.env` point at
  the staging API; locally both at 127.0.0.1:8098) — not an environment mismatch.
- Fix: `revalidate: 0` for the three geography reads (address pages only). No backend/admin/schema change; IDs untouched.
- Regression: `tests/e2e/account/geography.spec.ts` test 91 (create → listed under Giza only; rename; deactivate → gone) failed on
  the old build ("Dokki, 6th of October"), passes ×2 after.
- Browser (real Admin Dashboard on :5180 against the local API): created "Sheikh Zayed QA" (id 11, region 2 Giza, country 1,
  active) → DB + public API showed it → website Add address listed it under Giza only (before the fix: missing after reload) →
  saved address 342 with city_id 11 → Checkout → Add address listed it after refresh → deactivated in Admin → gone from new
  address form; existing address 342 still shows its city in Edit → reactivated.

## BUG-008 (P2) — signed-in Add to cart lost when leaving the page right after (journey test 70) — FIXED
- Evidence: trace of test 70 on MariaDB — PDP server actions ran ONE AT A TIME (Next.js action queue): an account load (2.0 s),
  then the next action started at 39.66 s and was aborted (status −1) by `goto('/en/cart')` at 39.89 s; the wishlist remove and
  the cart add were still queued. DB for that shopper: 0 cart items, 0 wishlist rows. Header had shown "1" (optimistic local
  state only). Answers to the brief: (1) yes — the mutation was never sent / was cancelled; (2) no — nothing was persisted;
  (3)/(4) no — the cart page correctly showed the (empty) account; (5) the test's navigation was legitimate customer behaviour.
  Manual "reload 30 ms after add" passed earlier because no other action was queued in front of the add.
- Fix (website only, no backend change): account cart/wishlist WRITES moved from server actions to keep-alive batches —
  `src/features/account/shop-writes.ts` (client queue: one request in flight, later writes batched in order, `pagehide` flush)
  → new route `src/app/[locale]/shop-sync/route.ts` (same-origin JSON only; batch applied in order) → `shop-core.ts` (the former
  action bodies, unchanged). `session-order.ts` serialises a shopper's operations per session in the server process, and
  `shop-actions.ts` (loads, merge) goes through it too, so the next page's account load waits for writes still being applied.
  Stores: `cart/store.ts`, `wishlist/store.ts`. Unit mock updated in `shopping-ui.test.tsx` (same assertions, new seam).
- Regression: `tests/e2e/account/cart-sync.spec.ts` 92 (save, remove, add, Escape, goto cart → line present AND in the API, wishlist
  empty) failed before (0 lines), 93 (add + reload). After: 92/93 ×3 = 6 passed; test 70 ×3 = 3 passed. Browser: same sequence as
  Nour → White/XL in the account (DB updated_at 15:31:03), wishlist 0. Endpoint: no/foreign Origin 403, text/plain 415, GET 405,
  signed out → `signedOut`. Unit 231/231.

## Resumed session (2026-11-10, afternoon) — further results
- OBS-01 FIXED: legend now one screen-reader string → group "Color: White" (first attempt read "Color : White"); shopping test.
- OBS-02 FIXED: order details "Includes tax" / "شامل الضريبة" (en/ar checked in browser on AM-261110-6WG6AT); account test 37.
- Order cancellation (UI): AM-261110-5XK3TJ placed → inline confirm → "Cancelled", pay link gone; DB cancelled /
  customer_requested, 2 holds released, reserved back down.
- Homepage sections, brand (Nilewood) and store (Volta Electronics) pages: en/ar at 320/390/768, no broken images.
- BUG-009 (P3) FIXED: store/brand/category H1 overflowed 4 px in Arabic at a 320 px window with a classic scrollbar (305 px; one
  long word at 30 px Alexandria). `text-2xl` below 360 px + `break-words`; storefront test fails at 305 px before, passes after.
  Phones (overlay scrollbars) were not affected.
- BUG-010 (P2, a11y) FIXED: closing the cart drawer with Escape dropped focus to <body> (opened via setCartDrawerOpen, no Radix
  trigger). Focus now returns to the control that opened it (not when leaving via a link). Shopping test fails before, passes after.
- Keyboard: skip link first (focus lands on body but Tab continues from #main — P3), mega menu Enter/Tab/Escape returns focus,
  2 px focus ring, mobile menu (ar 390) focus inside + returns on Escape. Dark mode (ar 390): products, cart, login fine.
- Environment: store cover image file missing in the QA public disk (also missing in the old runtime) → 404 image requests on the
  store page; demo data gap, not code.

## Account E2E on MariaDB (before the OBS-01/02 edits): 79 passed, 82 skipped, 1 failed
- Test 70 fails again at "/en/cart shows the added line" (0 lines), so it is NOT only the slow SQLite runtime. The manual
  reload 30 ms after Add to cart kept the item, so the difference is in the test's path (wishlist toggle, then add, Escape, goto).
  Open as a likely P2 race in the account cart sync (an add lost when navigating right after); investigate first on resume.

## Note: MariaDB was stopped by Claude Code (system low on memory) after the run
The `mysqld --standalone` I started was killed; the `alo_mart_zz_rcqa` data stays on disk. On resume, restart it
(`E:/xampp/mysql/bin/mysqld.exe --defaults-file=E:/xampp/mysql/bin/my.ini --standalone --console`) only if needed, and check
that the API workers on 8101-8103 answer again.

## FINAL (2026-11-10) — COMPLETE
- Gates: tsc 0, ESLint 0, unit 231/231, build 0, full Playwright (1 worker) 179 passed / 1 failed / 106 skipped; the failure
  (account test 31, hard-coded Giza city list vs the QA city) fixed to compare with the live API list and rerun: passed.
- Report: `docs/real-customer-qa-report.md` (CONDITIONAL PASS).
- Cleanup done: browser closed; my next (3100), admin vite (5180), proxy (8098), php workers (8101-8103) stopped; MariaDB I started
  shut down; DB `alo_mart_zz_rcqa` KEPT (as requested); local admin token file deleted; MCP screenshots/snapshots moved from
  `E:\xampp\htdocs\alo-mart\.playwright-mcp\` to `E:\workspace\alo-mart\redesign-evidence\real-customer-qa\` (backend repo clean).

## Closure (2026-11-11/12)
- Review of shop-sync found a real cross-account write after an account switch in another tab → fixed with a session
  fingerprint (test 94). Single-process ordering limit documented (report §6, `session-order.ts`).
- Local commits on `feature/navbar-and-customer-journey`: font, email verification, geography, cart/wishlist sync,
  responsive + accessibility, tests + docs (hashes in the final report).

## (historical) RESUME HERE (stopped at usage limit, 2026-11-10)
1. A background run of `tests/e2e/account` (one worker) was started BEFORE the OBS-01/OBS-02 edits; result in
   `rcqa/pw-account.log` (session scratchpad). Read it; investigate any failure.
2. Rebuild (`rcqa/rebuild.sh`), run shopping option-group test + account test 37, browser-check both.
3. Remaining: Journey A homepage sections/brand/store pages; responsive 320/390/768 spot checks + dark; keyboard/focus;
   order cancellation by customer in UI; expired payment (lifecycle spec covers); full Playwright once; tsc/eslint/vitest/build.
4. Write `docs/real-customer-qa-report.md`. Cleanup: stop php workers 8101-8103, front 8098, next 3100, mysqld (started by me),
   DROP `alo_mart_zz_rcqa`, move `E:\xampp\htdocs\alo-mart\.playwright-mcp\` screenshots to
   `E:\workspace\alo-mart\redesign-evidence\real-customer-qa\` and delete that folder (it is untracked in the main backend repo).

## Notes
- Known before this task: journey test 70 fails at "/en/cart shows the added line" on the committed code as well (the account
  cart write is cancelled by navigating ~0.7 s after Add to cart, on the slow single-worker SQLite runtime). Re-check on MariaDB.
