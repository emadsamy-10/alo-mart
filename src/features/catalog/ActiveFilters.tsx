"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney, isolate } from "@/lib/i18n/format";
import { CatalogLink, useCatalog } from "./CatalogNavigation";
import { cleared, hasFilters, toggled, withAttr, withPatch, type CatalogState } from "./filters";

/** Display names the server resolved for the URL's slugs and codes. */
export interface FilterLabels {
  categories: Record<string, string>;
  brands: Record<string, string>;
  stores: Record<string, string>;
  attributes: Record<string, { name: string; values: Record<string, string> }>;
}

interface Chip {
  key: string;
  label: string;
  to: CatalogState;
}

/**
 * Applied filters as removable chips (each a real link to the state without
 * it), plus "Clear all". Built from the in-flight state, so a removed chip
 * disappears at once.
 */
export function ActiveFilters({ labels, currency }: { labels: FilterLabels; currency: { code: string; decimal_places: number } }) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  const { state } = useCatalog();
  const money = (v: string) => formatMoney(v, currency, locale) ?? v;

  const chips: Chip[] = [
    ...(state.q ? [{ key: "q", label: t("chipSearch", { term: isolate(state.q) }), to: withPatch(state, { q: null }) }] : []),
    ...state.categories.map((slug) => ({
      key: `category:${slug}`,
      label: labels.categories[slug] ?? slug,
      to: withPatch(state, { categories: toggled(state.categories, slug) }),
    })),
    ...(state.descendants ? [{ key: "descendants", label: t("chipSubcategories"), to: withPatch(state, { descendants: false }) }] : []),
    ...(state.min !== null || state.max !== null
      ? [
          {
            key: "price",
            label:
              state.min !== null && state.max !== null
                ? t("chipPriceRange", { min: money(state.min), max: money(state.max) })
                : state.min !== null
                  ? t("chipPriceFrom", { min: money(state.min) })
                  : t("chipPriceTo", { max: money(state.max!) }),
            to: withPatch(state, { min: null, max: null }),
          },
        ]
      : []),
    ...(state.inStock ? [{ key: "in_stock", label: t("inStockOnly"), to: withPatch(state, { inStock: false }) }] : []),
    ...(state.onSale ? [{ key: "on_sale", label: t("onSaleOnly"), to: withPatch(state, { onSale: false }) }] : []),
    ...Object.entries(state.attrs).flatMap(([code, values]) =>
      values.map((value) => {
        const attribute = labels.attributes[code];
        const name = attribute?.values[value] ?? value;
        return { key: `attr:${code}:${value}`, label: attribute ? `${attribute.name}: ${name}` : name, to: withAttr(state, code, value) };
      }),
    ),
    ...state.brands.map((slug) => ({ key: `brand:${slug}`, label: labels.brands[slug] ?? slug, to: withPatch(state, { brands: toggled(state.brands, slug) }) })),
    ...state.stores.map((slug) => ({ key: `store:${slug}`, label: labels.stores[slug] ?? slug, to: withPatch(state, { stores: toggled(state.stores, slug) }) })),
  ];

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("activeFilters")} data-testid="active-filters">
      {chips.map((chip) => (
        <CatalogLink
          key={chip.key}
          to={chip.to}
          aria-label={t("removeFilter", { name: chip.label })}
          className="inline-flex h-11 max-w-full items-center gap-1.5 rounded-full bg-ink ps-3.5 pe-3 text-[0.8125rem] font-semibold text-ink-foreground transition hover:bg-ink/85 lg:h-9 lg:pe-2.5"
          data-testid="filter-chip"
        >
          <span className="truncate">{chip.label}</span>
          <X className="size-3.5 shrink-0" aria-hidden />
        </CatalogLink>
      ))}
      {hasFilters(state) ? (
        <CatalogLink
          to={cleared(state)}
          className="inline-flex h-11 items-center rounded-full px-3 text-[0.8125rem] font-bold text-brand-text hover:underline lg:h-9"
          data-testid="clear-all"
        >
          {t("clearAll")}
        </CatalogLink>
      ) : null}
    </div>
  );
}
