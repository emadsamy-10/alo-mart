# ALO MART Storefront — Design Reference Audit

Source: 19 mobile screenshots in `design-references/` (read-only, Arabic/RTL concept).
They are a design language to translate, not assets to ship.

## What the screens cover

| Screen | Patterns worth keeping | Not in Phase 1 (no backend capability) |
|---|---|---|
| Home | Compact header, rounded search field, 4-col image category grid with labels below, full-bleed hero card with image + headline + red CTA, segmented tabs, horizontal product cards | City selector, notifications bell, camera search, ratings stars, "verified store" claims |
| Category listing | Image header with breadcrumb + title, pill sub-category chips (active = navy fill), filter/sort entry, 2-col product grid | Grid/list toggle, AR badge, map CTA |
| Sort / filter sheets | Bottom sheets: 28px top radius, drag handle, close button in a soft circle, navy-filled selected state | Seller-type & material facets (no API) |
| Product detail | Full-bleed gallery with dots, white rounded info panel overlapping image, large price + struck price + red discount chip, spec table, store card | AR, installments, ratings, reviews, delivery promises, warranty |
| Store profile / list | Cover image, logo in a white rounded frame overlapping, red underline tabs | Followers, follow button, ratings |
| Category directory | White rounded tiles, product cut-out image, centered label | Bottom nav with cart / wishlist / account |
| Country picker | Flag + name + `CODE • currency` rows, selected = red outline + red check, sticky confirm | — |
| Search | Recent searches chips, trending list, image category tiles with overlaid label | Whole screen (no search endpoint) |
| B2B / AR / reviews | — | Entire screens are future concepts |

## Visual language

1. **Common patterns** — soft rounded containers on a warm off-white page; image-first cards; one dark navy element per screen for emphasis (selected chip, primary button, AR band); red reserved for brand, discount and the single most important CTA.
2. **Palette** — page `#FAF7F2`-ish ivory, white cards, deep navy `#0F172A`-ish ink and primary buttons, brand red `~#B91F2A` (matches Admin `--primary: #b91f2a`), beige/sand surfaces, slate-grey secondary text, green for "available".
3. **Typography** — heavy geometric Arabic sans for headings (Tajawal/Cairo-like, 700–800), regular weight body, prices in bold with smaller currency suffix. Hierarchy is weight-driven more than size-driven.
4. **Spacing / density** — 16–20px gutters on mobile, 12–16px between cards, generous 28–40px between sections. Dense but never cramped.
5. **Radii** — hierarchy: sheets/hero 28–32px, cards 20–24px, image wells 16–20px, inputs 16px, chips fully rounded.
6. **Shadows / borders** — almost no hard borders; cards separate from the ivory page by being white with a very soft, wide, low-opacity shadow. Hairline borders only on unselected chips/inputs.
7. **Product card** — image well (rounded, light bg), optional top-corner overlay (wishlist / badge), title (1–2 lines), store line with verification tick, price row (bold number + small currency), optional rating, tag chips.
8. **Category card** — two forms: (a) rounded square image with label beneath (home), (b) white tile with cut-out image and centered label (directory), (c) photo tile with overlaid label (search).
9. **Navigation** — back/forward chevrons in white circles; pill chips for sub-navigation; bottom tab bar (Home / Categories / Wishlist / Cart / Account).
10. **Mobile interactions** — horizontal scroll rows that bleed off the edge (signals scrollability), bottom sheets, sticky bottom CTA.
11. **RTL** — layouts are authored RTL-first: chevrons mirror, prices keep Latin digits with currency after the number, scroll rows start from the right.
12. **Desktop adaptation** — keep the rounded-panel language and ivory/navy/red palette, but compose with a max-width container, a mega menu instead of the category grid screen, multi-column product grids (4–5 cols), carousels with explicit prev/next controls, and a full footer.

## Translation into the storefront design system

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--background` | `#FBF8F4` warm ivory | `#0B1120` deep navy | page |
| `--surface` | `#FFFFFF` | `#131B2E` | cards, panels |
| `--surface-muted` | `#F3EDE6` | `#1A2338` | image wells, chips |
| `--sand` | `#EDE6DE` | `#232C42` | beige accents, dividers |
| `--ink` | `#10182D` deep navy | `#F4EFE8` ivory | text, primary buttons |
| `--muted-foreground` | `#5E5A55` | `#A9A59E` | secondary text (AA on both) |
| `--brand` | `#B91F2A` | `#E5484D` | brand red, discount, focus |
| `--success` | `#17803D` | `#4ADE80` | in-stock |

Dark mode is a navy "showroom" — not an inversion: cards are lifted navy, image wells stay slightly lighter so product cut-outs on white backgrounds don't glare, and red is brightened for contrast.

Type: **Tajawal** (Arabic, 400/500/700/800) and **Geist** (Latin, variable). Arabic locale leads with Tajawal; English with Geist, Tajawal as fallback for Arabic brand names.

Signature element: the **navy hero panel** — the one dark, large-radius surface on the homepage, holding the headline and a mosaic of the real department photography from the API. Everything else stays quiet: ivory page, white cards, red only for the brand and real discounts.

## Deliberately not reproduced (no backend capability today)

Ratings/stars, reviews, AR, installments, chat, follow store, wishlist, cart badge, delivery/installation promises, "verified" ticks, location/city picker, search (the API has no text search parameter), B2B supplier marketplace.
