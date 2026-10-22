# ALO MART — Storefront

Customer-facing, SEO-first, bilingual (Arabic RTL / English) storefront for the ALO MART multi-vendor
marketplace. Next.js 16 App Router, server-rendered from the ALO MART Laravel API.

## Requirements

- Node.js ≥ 20.9 (tested on 20.19)
- Network access to the ALO MART API

## Getting started

```bash
cp .env.example .env.local     # adjust SITE_URL / DEFAULT_MARKET if needed
npm install
npm run dev                    # http://localhost:3000 → redirects to /ar or /en
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` / `npm start` | Production build / server |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests against `next start` (run `npm run build` first; first time: `npx playwright install chromium`) |
| `npm run check` | typecheck + lint + unit tests |

## Environment

See [.env.example](.env.example). Key switch: `SITE_INDEXABLE` — anything but `true` makes the deployment
non-indexable (meta robots, `X-Robots-Tag`, robots.txt). Set it to `true` only on the production hostname,
at build and runtime.

## Docs

- [docs/architecture.md](docs/architecture.md) — structure, caching, URL/market strategy, SEO scope
- [docs/api-contract.md](docs/api-contract.md) — audited API contract and backend limitations
- [docs/design-audit.md](docs/design-audit.md) — design-reference audit and design tokens
- [docs/screenshots/](docs/screenshots) — Phase 1 QA screenshots
