"use client";

import { ArrowDownUp, Check, ChevronDown, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, Select } from "radix-ui";
import { useState } from "react";
import { localeDirection } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";
import { useCatalog } from "./CatalogNavigation";
import { SORTS, searchUsesRelevance, withPatch, type SortKey } from "./filters";

/** "default" = no sort parameter: newest, or the API's relevance order for a search. */
type SortChoice = SortKey | "default";

const LABEL = {
  newest: "sortNewest",
  price_asc: "sortPriceAsc",
  price_desc: "sortPriceDesc",
  name_asc: "sortNameAsc",
  name_desc: "sortNameDesc",
  best_selling: "sortBestSelling",
} as const satisfies Record<SortKey, string>;

/**
 * Every sort the API supports. Sorting never changes WHICH products match
 * (the API guarantees it), only their order, and returns to page 1.
 */
export function useSortOptions() {
  const t = useTranslations("Catalog");
  const { state, navigate } = useCatalog();
  // "Best match" only when the API really ranks this search (FULLTEXT); a short, stopword or
  // punctuated term falls back to a newest-first substring match, and is labelled so.
  const searching = searchUsesRelevance(state.q);
  // Without a search, "newest" IS the default: keep one canonical URL for it.
  const options: { value: SortChoice; label: string }[] = [
    { value: "default", label: searching ? t("sortRelevance") : t("sortNewest") },
    ...SORTS.filter((s) => searching || s !== "newest").map((s) => ({ value: s as SortChoice, label: t(LABEL[s]) })),
  ];
  const current: SortChoice = state.sort === null || (!searching && state.sort === "newest") ? "default" : state.sort;
  const choose = (value: SortChoice) => {
    if (value === current) return;
    navigate(withPatch(state, { sort: value === "default" ? null : value }));
  };
  return { options, current, choose };
}

/** Desktop: a dropdown. */
export function SortSelect({ className }: { className?: string }) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  const { options, current, choose } = useSortOptions();
  const currentLabel = options.find((o) => o.value === current)?.label;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span id="sort-label" className="text-sm text-muted-foreground">
        {t("sortLabel")}
      </span>
      <Select.Root value={current} onValueChange={(v) => choose(v as SortChoice)} dir={localeDirection(locale)}>
        <Select.Trigger
          aria-labelledby="sort-label"
          data-testid="sort-select"
          className="inline-flex h-11 min-w-48 items-center justify-between gap-3 rounded-full border border-border-strong bg-surface ps-4 pe-3 text-sm font-bold shadow-sm outline-none transition hover:border-ink focus-visible:ring-2 focus-visible:ring-(--focus-ring)/40"
        >
          <Select.Value>{currentLabel}</Select.Value>
          <Select.Icon>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            align="end"
            className="z-50 min-w-(--radix-select-trigger-width) overflow-hidden rounded-2xl bg-surface p-1.5 shadow-popover ring-1 ring-border"
          >
            <Select.Viewport>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-10 cursor-pointer items-center rounded-xl ps-3 pe-9 text-sm outline-none select-none data-highlighted:bg-surface-muted data-[state=checked]:font-bold"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="absolute end-3 inline-flex">
                    <Check className="size-4 text-brand-text" aria-hidden />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}

/** Mobile: a bottom sheet of radio rows (design reference "ترتيب حسب"). */
export function SortSheet({ className }: { className?: string }) {
  const t = useTranslations("Catalog");
  const { options, current, choose } = useSortOptions();
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        data-testid="open-sort"
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-bold shadow-sm",
          className,
        )}
      >
        <ArrowDownUp className="size-4" aria-hidden />
        {t("sortLabel")}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-background pb-[max(1rem,env(safe-area-inset-bottom))] shadow-popover outline-none"
        >
          <span className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border-strong" aria-hidden />
          <div className="flex items-center justify-between border-b border-border px-5 pt-3 pb-3">
            <Dialog.Title className="text-lg font-extrabold">{t("sortTitle")}</Dialog.Title>
            <Dialog.Close aria-label={t("close")} className="grid size-11 place-items-center rounded-full bg-surface-muted">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <fieldset className="space-y-2 overflow-y-auto px-4 pt-4">
            <legend className="sr-only">{t("sortTitle")}</legend>
            {options.map((option) => {
              const selected = option.value === current;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 text-[0.9375rem] transition has-focus-visible:outline-2 has-focus-visible:outline-(--focus-ring)",
                    selected ? "border-transparent bg-surface-muted font-bold" : "border-border bg-surface hover:bg-surface-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="catalog-sort"
                    value={option.value}
                    checked={selected}
                    onChange={() => {
                      setOpen(false);
                      choose(option.value);
                    }}
                    className="sr-only"
                  />
                  {option.label}
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border-2",
                      selected ? "border-ink bg-ink text-ink-foreground" : "border-border-strong",
                    )}
                  >
                    {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
