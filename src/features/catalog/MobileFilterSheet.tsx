"use client";

import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { useCatalog } from "./CatalogNavigation";
import { activeFilterCount, cleared, hasFilters } from "./filters";
import { FilterPanel, type FilterPanelData } from "./FilterPanel";

/**
 * Mobile filter bottom sheet (design reference: rounded top, drag handle,
 * circular close, reset + primary "show N results" pinned at the bottom).
 * Choices apply immediately, like on desktop: the sheet stays open across
 * the navigation, so its counts and the result total are always live.
 */
export function MobileFilterSheet({ data, total }: { data: FilterPanelData; total: number }) {
  const t = useTranslations("Catalog");
  const { state, navigate, pending } = useCatalog();
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(state);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-bold shadow-sm lg:hidden"
        data-testid="open-filters"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {t("openFilters")}
        {active ? (
          <span className="grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.6875rem] leading-5 font-bold text-brand-foreground tabular-nums">
            {active}
          </span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.75rem] bg-background shadow-popover outline-none"
          data-testid="filter-sheet"
        >
          <span className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-border-strong" aria-hidden />
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 pt-3 pb-3">
            <Dialog.Title className="text-lg font-extrabold">{t("filtersTitle")}</Dialog.Title>
            <Dialog.Close aria-label={t("close")} className="grid size-11 place-items-center rounded-full bg-surface-muted">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-1" aria-busy={pending || undefined}>
            <FilterPanel data={data} idPrefix="m" />
          </div>
          <div className="grid shrink-0 grid-cols-[auto_1fr] items-center gap-3 border-t border-border bg-background px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              disabled={!hasFilters(state)}
              onClick={() => navigate(cleared(state))}
              className="inline-flex h-12 items-center rounded-full px-4 text-sm font-bold text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              {t("reset")}
            </button>
            <Dialog.Close
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground"
              data-testid="show-results"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("updating")}
                </>
              ) : (
                t("showResults", { count: total })
              )}
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
