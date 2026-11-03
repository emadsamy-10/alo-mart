"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { useCatalog } from "./CatalogNavigation";
import { toggled, withAttr, withPatch } from "./filters";
import { PriceRangeFilter, type PriceBounds } from "./PriceRangeFilter";

/** Category structure (from the category tree) with the facet count of each category's OWN products. */
export interface FilterCategory {
  id: number;
  slug: string;
  name: string;
  count: number;
  children: FilterCategory[];
}

export interface FilterOption {
  slug: string;
  name: string;
  /** Catalog-wide count with this group's own filter removed (drill-down). */
  count: number;
}

export interface FilterAttributeValue {
  code: string;
  name: string;
  count: number;
  /** Valid hex for color swatches, else null. */
  swatch: string | null;
}

export interface FilterAttribute {
  code: string;
  name: string;
  /** Every value has a usable color → swatches. */
  swatches: boolean;
  values: FilterAttributeValue[];
}

export interface FilterPanelData {
  categories: FilterCategory[];
  brands: FilterOption[];
  stores: FilterOption[];
  attributes: FilterAttribute[];
  price: PriceBounds;
  currency: { code: string; decimal_places: number };
  currencyLabel: string;
}

const VISIBLE = 6;

export function subtreeCount(node: FilterCategory): number {
  return node.children.reduce((n, c) => n + subtreeCount(c), node.count);
}

function containsSelected(node: FilterCategory, selected: string[]): boolean {
  return selected.includes(node.slug) || node.children.some((c) => containsSelected(c, selected));
}

/** Slugs of categories that have sub-categories: only those make "include sub-categories" meaningful. */
function parentSlugs(nodes: FilterCategory[], out = new Set<string>()): Set<string> {
  for (const n of nodes) {
    if (n.children.length) out.add(n.slug);
    parentSlugs(n.children, out);
  }
  return out;
}

interface CheckRowProps {
  id: string;
  checked: boolean;
  onChange: () => void;
  label: ReactNode;
  count?: number;
  testId?: string;
  lead?: ReactNode;
}

/**
 * Every filter the API supports, driven by the facets response: options and
 * counts are catalog-wide (never from the loaded page), each group counted
 * with its own selection removed so it stays usable. Choices apply at once
 * (the URL is the state); while the new results load, counts are hidden
 * rather than shown for the previous selection.
 */
export function FilterPanel({ data, idPrefix }: { data: FilterPanelData; idPrefix: string }) {
  const t = useTranslations("Catalog");
  const { state, navigate, pending } = useCatalog();
  const parents = parentSlugs(data.categories);
  const parentSelected = state.categories.some((s) => parents.has(s));
  // Sub-categories are included by default; once a parent is selected the URL decides
  // (the switch below). Parent rows count their whole subtree when they are included, else
  // their own products, so the number shown is always what choosing the row returns.
  const includeSub = parentSelected ? state.descendants : true;

  const row = ({ id, checked, onChange, label, count, testId, lead }: CheckRowProps) => (
    <label
      htmlFor={id}
      data-testid={testId}
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2.5 text-sm transition-colors hover:bg-surface-muted has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring)"
    >
      <input id={id} type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span
        aria-hidden
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border-2 transition",
          checked ? "border-ink bg-ink text-ink-foreground" : "border-border-strong bg-surface",
        )}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {lead}
      <span className={cn("min-w-0 flex-1 leading-snug", checked && "font-bold")}>{label}</span>
      {count === undefined || count === 0 ? null : pending ? (
        <span className="h-3 w-5 shrink-0 animate-pulse rounded bg-skeleton" aria-hidden />
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </label>
  );

  return (
    <div className="pb-2">
      {data.categories.some((n) => subtreeCount(n) > 0 || containsSelected(n, state.categories)) ? (
        <Group title={t("categories")} testId="filter-group-category">
          <CategoryTree
            nodes={data.categories}
            depth={0}
            includeSub={includeSub}
            render={(node, count) =>
              row({
                id: `${idPrefix}-cat-${node.slug}`,
                checked: state.categories.includes(node.slug),
                onChange: () => {
                  const categories = toggled(state.categories, node.slug);
                  // descendants only means something when a chosen category has children.
                  navigate(withPatch(state, { categories, descendants: includeSub && categories.some((s) => parents.has(s)) }));
                },
                label: node.name,
                count,
                testId: `filter-category-${node.slug}`,
              })
            }
          />
          {parentSelected ? (
            <label className="mx-0.5 mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 text-sm font-semibold has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring)">
              {t("includeSubcategories")}
              <input
                type="checkbox"
                role="switch"
                checked={state.descendants}
                onChange={() => navigate(withPatch(state, { descendants: !state.descendants }))}
                className="peer sr-only"
                data-testid="include-descendants"
              />
              <span
                aria-hidden
                className="relative h-6 w-10 shrink-0 rounded-full bg-border-strong transition peer-checked:bg-ink after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-surface after:shadow-sm after:transition-all peer-checked:after:start-[1.125rem]"
              />
            </label>
          ) : null}
        </Group>
      ) : null}

      <Group title={t("price")} testId="filter-group-price">
        <PriceRangeFilter bounds={data.price} currency={data.currency} currencyLabel={data.currencyLabel} />
      </Group>

      <Group title={t("availability")} testId="filter-group-availability">
        {row({
          id: `${idPrefix}-in-stock`,
          checked: state.inStock,
          onChange: () => navigate(withPatch(state, { inStock: !state.inStock })),
          label: t("inStockOnly"),
          testId: "filter-in-stock",
        })}
        {row({
          id: `${idPrefix}-on-sale`,
          checked: state.onSale,
          onChange: () => navigate(withPatch(state, { onSale: !state.onSale })),
          label: t("onSaleOnly"),
          testId: "filter-on-sale",
        })}
      </Group>

      {data.attributes.map((attribute) => {
        const selected = state.attrs[attribute.code] ?? [];
        const valueRow = (code: string, name: string, count: number, lead?: ReactNode) =>
          row({
            id: `${idPrefix}-attr-${attribute.code}-${code}`,
            checked: selected.includes(code),
            onChange: () => navigate(withAttr(state, attribute.code, code)),
            label: name,
            count,
            testId: `filter-attr-${attribute.code}-${code}`,
            lead,
          });
        return (
          <Group key={attribute.code} title={attribute.name} testId={`filter-group-attr-${attribute.code}`}>
            {attribute.swatches ? (
              <ul>
                {attribute.values.map((value) => (
                  <li key={value.code}>
                    {valueRow(
                      value.code,
                      value.name,
                      value.count,
                      <span
                        aria-hidden
                        className="-ms-1 size-5 shrink-0 rounded-full ring-1 ring-border-strong ring-offset-1 ring-offset-surface"
                        style={{ backgroundColor: value.swatch ?? undefined }}
                      />,
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <OptionList
                options={attribute.values.map((v) => ({ slug: v.code, name: v.name, count: v.count }))}
                selected={selected}
                render={(option) => valueRow(option.slug, option.name, option.count)}
              />
            )}
          </Group>
        );
      })}

      {data.attributes.length === 0 ? (
        <p className="mx-2.5 my-4 rounded-xl bg-surface-muted px-3.5 py-3 text-xs leading-relaxed text-muted-foreground" data-testid="attributes-hint">
          {t("attributesHint")}
        </p>
      ) : null}

      {data.brands.length ? (
        <Group title={t("brands")} testId="filter-group-brand">
          <OptionList
            options={data.brands}
            selected={state.brands}
            searchable={data.brands.length > 8}
            searchLabel={t("searchBrands")}
            render={(option) =>
              row({
                id: `${idPrefix}-brand-${option.slug}`,
                checked: state.brands.includes(option.slug),
                onChange: () => navigate(withPatch(state, { brands: toggled(state.brands, option.slug) })),
                label: option.name,
                count: option.count,
                testId: `filter-brand-${option.slug}`,
              })
            }
          />
        </Group>
      ) : null}

      {data.stores.length ? (
        <Group title={t("stores")} testId="filter-group-store">
          <OptionList
            options={data.stores}
            selected={state.stores}
            searchable={data.stores.length > 8}
            searchLabel={t("searchStores")}
            render={(option) =>
              row({
                id: `${idPrefix}-store-${option.slug}`,
                checked: state.stores.includes(option.slug),
                onChange: () => navigate(withPatch(state, { stores: toggled(state.stores, option.slug) })),
                label: option.name,
                count: option.count,
                testId: `filter-store-${option.slug}`,
              })
            }
          />
        </Group>
      ) : null}
    </div>
  );
}

function Group({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <details open className="group/f border-b border-border last:border-b-0" data-testid={testId}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-2.5 text-sm font-extrabold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open/f:rotate-180" aria-hidden />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

function CategoryTree({
  nodes,
  depth,
  includeSub,
  render,
}: {
  nodes: FilterCategory[];
  depth: number;
  includeSub: boolean;
  render: (node: FilterCategory, count: number) => ReactNode;
}) {
  const { state } = useCatalog();
  const t = useTranslations("Catalog");
  // Impossible options are not offered; a selected one always stays so it can be removed.
  const visible = nodes.filter((n) => subtreeCount(n) > 0 || containsSelected(n, state.categories));
  if (!visible.length) return null;

  return (
    <ul className={cn(depth > 0 && "ms-4 border-s border-border ps-1.5")}>
      {visible.map((node) => {
        const count = includeSub ? subtreeCount(node) : node.count;
        const branch = node.children.some((c) => subtreeCount(c) > 0 || containsSelected(c, state.categories));
        return (
          <li key={node.slug}>
            {branch ? (
              <CategoryBranch
                label={t("toggleSubcategories", { name: node.name })}
                initiallyOpen={node.children.some((c) => containsSelected(c, state.categories))}
                row={render(node, count)}
              >
                <CategoryTree nodes={node.children} depth={depth + 1} includeSub={includeSub} render={render} />
              </CategoryBranch>
            ) : (
              render(node, count)
            )}
          </li>
        );
      })}
    </ul>
  );
}

function CategoryBranch({ label, initiallyOpen, row, children }: { label: string; initiallyOpen: boolean; row: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  return (
    <>
      <div className="flex items-center gap-0.5">
        <div className="min-w-0 flex-1">{row}</div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          aria-label={label}
          onClick={() => setOpen((v) => !v)}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        >
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>
      <div id={id} hidden={!open}>
        {children}
      </div>
    </>
  );
}

function OptionList({
  options,
  selected,
  render,
  searchable = false,
  searchLabel,
}: {
  options: FilterOption[];
  selected: string[];
  render: (option: FilterOption) => ReactNode;
  searchable?: boolean;
  searchLabel?: string;
}) {
  const t = useTranslations("Catalog");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const id = useId();
  const needle = query.trim().toLocaleLowerCase();
  const matching = needle ? options.filter((o) => o.name.toLocaleLowerCase().includes(needle)) : options;
  // Selected options always stay visible so they can be removed.
  const shown = expanded || needle ? matching : matching.filter((o, i) => i < VISIBLE || selected.includes(o.slug));

  return (
    <div>
      {searchable ? (
        <div className="relative mx-2.5 mb-2">
          <label htmlFor={id} className="sr-only">
            {searchLabel}
          </label>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel}
            className="h-10 w-full rounded-full border border-border bg-surface ps-9 pe-3 text-sm outline-none focus-visible:border-ink"
          />
        </div>
      ) : null}
      <ul>
        {shown.map((option) => (
          <li key={option.slug}>{render(option)}</li>
        ))}
      </ul>
      {needle && matching.length === 0 ? <p className="px-2.5 py-2 text-sm text-muted-foreground">{t("noOptionMatch")}</p> : null}
      {!needle && options.length > VISIBLE ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-10 items-center gap-1.5 px-2.5 text-sm font-semibold text-brand-text hover:underline"
        >
          {expanded ? t("showLess") : t("showMore", { count: options.length })}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
