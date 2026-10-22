@AGENTS.md

# ALO MART Storefront — project instructions

Customer-facing, SEO-first, bilingual (Arabic RTL default / English) marketplace storefront.
Next.js 16.3 App Router · React 19 · TypeScript strict · Tailwind 4 · next-intl · next-themes · Radix.
Data comes from the ALO MART Laravel API (staging: `https://api.alo-mart.web-apps.site/api/v1`), read-only.

## Scope & safety
- Only modify this repository. `E:\xampp\htdocs\alo-mart` (backend), `alo-mart-admin-dashboard`,
  `alo-mart-merchant-dashboard` and `design-references` are **read-only** — inspect, never edit,
  format, commit, reset or stash there.
- Never write to the staging API (no POST/PUT/DELETE, migrations, seeders). Never change backend
  contracts to suit the storefront — document missing capabilities in `docs/api-contract.md` instead.
- Don't push or deploy unless asked. No attribution trailers in commits.

## Non-negotiables
- **Honesty:** render only real API data. No fake ratings, reviews, stock, discounts, badges, trust
  claims, mock products, or controls that do nothing. Adapt design elements that lack data
  (`.claude/skills/luxury-ui/references/honesty-matrix.md`).
- **SEO:** indexable content and metadata are server-rendered; every localized page uses
  `generateMetadata` → `pageMetadata()`; staging stays `noindex` (`SITE_INDEXABLE`).
- **Architecture:** API only via `apiGet()` (`src/lib/api/client.ts`) + zod schemas; images only via
  `AppImage`; links via `@/lib/i18n/navigation`; env only via `src/lib/env.ts`; colors only via tokens in
  `src/app/globals.css`; UI strings only in `messages/{ar,en}.json` (same keys); logical RTL utilities.
- Market is an httpOnly cookie (`alo_market`), not a URL dimension; default `DEFAULT_MARKET=EG`.

## Design sources
- Approved desktop design: `../design-references/homepage.png`. Mobile references: the `*.jpeg`
  screens in the same folder. Audit: `docs/design-audit.md`.

## Commands
`npm run dev` · `npm run build` · `npx next start -p 3100` · `npm run typecheck` · `npm run lint` ·
`npm test` · `npm run test:e2e` (production server on port 3100; free the port first — a stale server
serves an old build) · `npm run check`.

## Project skills (`.claude/skills/`)
- `/luxury-ui` — any visual work: tokens, components, desktop/mobile composition, RTL, dark mode.
- `/responsive-qa` — real-browser sweep + interactions + screenshots after UI changes.
- `/seo-audit` — metadata, JSON-LD, canonical/hreflang, sitemap/robots, crawler view, lab CWV.
- `/storefront-review` — final gate before calling work done or committing.

## Environment notes
- Windows; Git Bash and PowerShell. No Python/ImageMagick — use the Playwright-based scripts in the skills.
- Next.js 16 differs from older versions: read `node_modules/next/dist/docs/` before using an unfamiliar API.

## Docs
`docs/architecture.md` (structure, caching, URL/market strategy) · `docs/api-contract.md` (real API
shapes + backend limitations) · `docs/design-audit.md` · `README.md`.
