"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { FILTER_KEYS } from "./filters";

/**
 * Mobile filter bottom sheet (design reference: rounded top, drag handle,
 * close button, Apply + Clear pinned at the bottom). The radios are
 * server-rendered (FilterPanel mode="form"); Apply navigates to the
 * filtered URL, so state stays in the URL like on desktop.
 */
export function MobileFilterSheet({ children, activeCount }: { children: ReactNode; activeCount: number }) {
  const t = useTranslations("Catalog");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query: Record<string, string> = {};
    for (const key of FILTER_KEYS) {
      const value = data.get(key);
      if (typeof value === "string" && value) query[key] = value;
    }
    setOpen(false);
    router.push({ pathname: "/products", query });
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-bold shadow-sm lg:hidden"
        data-testid="open-filters"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        {t("openFilters")}
        {activeCount ? (
          <span className="grid size-5 place-items-center rounded-full bg-brand text-[0.6875rem] font-bold text-brand-foreground">{activeCount}</span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          className="sheet-up fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-background shadow-popover outline-none"
        >
          <span className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-border-strong" aria-hidden />
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <Dialog.Title className="text-lg font-extrabold">{t("filtersTitle")}</Dialog.Title>
            <Dialog.Close aria-label={t("close")} className="grid size-11 place-items-center rounded-full bg-surface-muted">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" data-testid="filter-form">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3">{children}</div>
            <div className="grid grid-cols-[auto_1fr] gap-3 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/products");
                }}
                className="inline-flex h-12 items-center rounded-full px-5 text-sm font-bold text-muted-foreground hover:text-foreground"
              >
                {t("clearAll")}
              </button>
              <button type="submit" className="inline-flex h-12 items-center justify-center rounded-full bg-ink text-sm font-bold text-ink-foreground">
                {t("apply")}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
