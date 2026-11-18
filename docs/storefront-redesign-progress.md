# Storefront redesign — progress ledger

Resume file for the luxury-modern storefront implementation (approved reference:
`../design-references/alo-home.png`). Update after every phase. **Nothing committed yet: commits wait for final review.**

## Runtime used for QA
- API: `php -S 127.0.0.1:8099 router.php` plus `node front.mjs 8098 8099`, both in the disposable runtime folder
  `web/backend-int` (old session scratchpad), with `ALO_BACKEND_DIR=E:/workspace/alo-mart/worktrees/staging-candidate`.
- Website: `ALO_API_BASE_URL=http://127.0.0.1:8098/api/v1 SITE_URL=http://localhost:3100 npm run build`, then `npx next start -p 3100`.

## Phases
- [x] Tokens and shell: utility bar, header, nav, mega menu, sticky, mobile, bottom nav, footer
- [x] Shared: ProductCard + quick add, headings, pagination, `/brands` index
- [x] Homepage: hero, benefits, categories, products, brands, offers
- [x] Catalog: layout, sidebar, toolbar, chips, mobile drawer
- [x] Visual QA: 1440, 1920, 768, 390; RTL and LTR; light and dark (scripts `qa/shots.mjs`, `qa/interact.mjs`, output `qa/redesign/`)
- [x] Gates (2026-11-05, against the local staging-candidate API): tsc 0, eslint 0, vitest 227/227, build 0.
  Full Playwright, one worker: 152 passed, 79 skipped, 1 failed. The failure was a test selector in test 23 (the greeting now
  also shows in the header); fixed, and test 23 then passed alone. The full suite was not repeated after that test-only fix.
  Outage spec 1/1. Screenshots: `E:\workspace\alo-mart\redesign-evidence\`.

## Next
Awaiting review; nothing is committed. Follow-up for approval: bring the category, brand and store landing pages onto the
new sidebar layout (they still use the older filter sheet, and work).

## Design adaptations (reference shows it, the platform has no data)
- Ratings and rating filter: no ratings source in the API, so omitted.
- Countdown on offers: no expiry field, so omitted.
- Per-page selector and grid/list toggle: not supported by the catalog state, so omitted.
- Returns and "delivery everywhere" claims: no policy or data, so replaced with factual statements.
- Payment badges: payment methods are only available to signed-in users, so omitted from the footer.
- Legal links, app badges, social links: no pages or accounts exist, so omitted.

## Navbar and real journey (2026-11-05)
Done:
- Navbar: red pill replaced by a neutral icon + text + chevron trigger; active page is a thin red underline; focus returns to
  the page after following a mega link. Evidence: `E:\workspace\alo-mart\redesign-evidence\navbar-before` and `navbar-after`.
- New spec `tests/e2e/account/journey.spec.ts` (tests 70-83): Login to Order Confirmation plus failures, on the real local
  backend with a disposable database. Evidence: `redesign-evidence\journey`.
- Fixed: a dropped connection while placing an order replaced checkout with an error page, and the background cart sync
  threw an uncaught error. The confirmation banner called unpaid orders "confirmed".
- Typecheck, ESLint, build and unit tests pass on the final code.

Final gates on the same code: tsc 0, ESLint 0, unit 227/227, build 0, full Playwright (one worker) 167 passed, 93 skipped,
0 failed, outage spec 1/1. Disposable test order: AM-261105-ZNT7PV (`df9148f3-63a3-49a8-88e4-a981ba501d23`).
Committed locally on `feature/navbar-and-customer-journey`; not pushed or deployed.
