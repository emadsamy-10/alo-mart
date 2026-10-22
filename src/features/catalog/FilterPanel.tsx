import { Check, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { BrandDetail, CategoryNode, StoreSummary } from "./api";
import { catalogQuery, withFilter, type CatalogState, type FilterKey } from "./filters";

interface FilterPanelProps {
  state: CatalogState;
  tree: CategoryNode[];
  brands: BrandDetail[];
  stores: StoreSummary[];
  /** "links": desktop sidebar (each choice is a crawlable link). "form": radios for the mobile sheet. */
  mode: "links" | "form";
}

const VISIBLE = 6;

/** Slugs from the root to the selected category (inclusive). */
function trailOf(tree: CategoryNode[], slug: string | null): string[] {
  if (!slug) return [];
  for (const node of tree) {
    if (node.slug === slug) return [node.slug];
    const inner = trailOf(node.children, slug);
    if (inner.length) return [node.slug, ...inner];
  }
  return [];
}

/**
 * Catalog filters — only those the public API applies to the whole eligible
 * catalog (category, brand, store). Price, availability, discount and
 * attribute filters are absent because the API has no such parameters yet.
 */
export async function FilterPanel({ state, tree, brands, stores, mode }: FilterPanelProps) {
  const t = await getTranslations("Catalog");
  const trail = trailOf(tree, state.category);

  const option = (key: FilterKey, value: string | null, label: ReactNode, depth = 0, testId?: string) => {
    const selected = state[key] === value;
    const pad = depth === 2 ? "ps-9" : depth === 1 ? "ps-5" : "";
    const body = (
      <>
        <span
          aria-hidden
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full border-2 transition",
            selected ? "border-ink bg-ink text-ink-foreground" : "border-border-strong",
          )}
        >
          {selected ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
        <span className={cn("min-w-0 flex-1 truncate", selected && "font-bold")}>{label}</span>
      </>
    );
    const row = cn("flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-sm transition-colors hover:bg-surface-muted", pad);

    return mode === "links" ? (
      <Link
        href={{ pathname: "/products", query: catalogQuery(withFilter(state, key, value)) }}
        aria-current={selected ? "true" : undefined}
        data-testid={testId}
        className={row}
      >
        {body}
      </Link>
    ) : (
      // In the sheet the visual follows the live radio state (peer-checked), not the URL.
      <label className={cn(row, "cursor-pointer has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring)")}>
        <input type="radio" name={key} value={value ?? ""} defaultChecked={selected} className="peer sr-only" />
        <span
          aria-hidden
          className="grid size-5 shrink-0 place-items-center rounded-full border-2 border-border-strong transition peer-checked:border-ink peer-checked:bg-ink peer-checked:text-ink-foreground [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="min-w-0 flex-1 truncate peer-checked:font-bold">{label}</span>
      </label>
    );
  };

  const group = (title: string, children: ReactNode) => (
    <section className="border-b border-border pb-4 last:border-b-0">
      <h3 className="px-2.5 pt-4 pb-2 text-sm font-extrabold">{title}</h3>
      {children}
    </section>
  );

  const flatList = (key: FilterKey, items: { slug: string; name: string }[], allLabel: string) => {
    const selectedIndex = items.findIndex((i) => i.slug === state[key]);
    const head = items.slice(0, VISIBLE);
    const rest = items.slice(VISIBLE);
    return (
      <ul>
        <li>{option(key, null, allLabel)}</li>
        {head.map((i) => (
          <li key={i.slug}>{option(key, i.slug, i.name, 0, `filter-${key}-${i.slug}`)}</li>
        ))}
        {rest.length ? (
          <li>
            <details open={selectedIndex >= VISIBLE} className="group/more">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-2.5 text-sm font-semibold text-brand-text [&::-webkit-details-marker]:hidden">
                {t("showMore", { count: items.length })}
                <ChevronDown className="size-4 transition-transform group-open/more:rotate-180" aria-hidden />
              </summary>
              <ul>
                {rest.map((i) => (
                  <li key={i.slug}>{option(key, i.slug, i.name, 0, `filter-${key}-${i.slug}`)}</li>
                ))}
              </ul>
            </details>
          </li>
        ) : null}
      </ul>
    );
  };

  // Links: children of the active path only. Form: every branch, collapsed unless active.
  const categoryList = (nodes: CategoryNode[], depth: number): ReactNode => (
    <ul>
      {nodes.map((node) => {
        const open = trail.includes(node.slug);
        const children = node.children.length ? categoryList(node.children, depth + 1) : null;
        if (mode === "form" && depth === 0 && children) {
          return (
            <li key={node.slug}>
              <details open={open} className="group/cat">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-2.5 text-sm font-semibold hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                  {node.name}
                  <ChevronDown className="size-4 transition-transform group-open/cat:rotate-180" aria-hidden />
                </summary>
                {option("category", node.slug, t("allIn", { name: node.name }), 1)}
                <div className="ps-2">{children}</div>
              </details>
            </li>
          );
        }
        return (
          <li key={node.slug}>
            {option("category", node.slug, node.name, depth, `filter-category-${node.slug}`)}
            {children && (mode === "form" || open) ? children : null}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div>
      {group(t("categories"), (
        <>
          {option("category", null, t("allCategories"))}
          {categoryList(tree, 0)}
        </>
      ))}
      {brands.length ? group(t("brands"), flatList("brand", brands, t("allBrands"))) : null}
      {stores.length ? group(t("stores"), flatList("store", stores, t("allStores"))) : null}
    </div>
  );
}
