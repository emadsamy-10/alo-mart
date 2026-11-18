"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Site-wide product search: a plain GET form to the catalog (`/products?q=`),
 * so it works before hydration, submits with Enter, and the results page is
 * the real, server-rendered catalog search.
 */
export function HeaderSearchForm({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  return (
    <form action={`/${locale}/products`} method="get" role="search" aria-label={t("searchLabel")} className={cn("flex items-center", className)} data-testid="header-search">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t("searchLabel")}</span>
        <input
          type="search"
          name="q"
          required
          minLength={2}
          maxLength={100}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-full border border-border-strong bg-surface ps-5 pe-13 text-base text-foreground shadow-[0_6px_18px_-14px_rgb(15_30_48/0.4)] transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-muted-foreground/80 focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none lg:h-12 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          aria-label={t("searchSubmit")}
          className="absolute inset-y-0 end-1 my-auto grid size-9 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-muted lg:size-10"
        >
          <Search className="size-5" aria-hidden />
        </button>
      </label>
    </form>
  );
}

/** Pinned desktop row: a search button opening the same form. */
export function HeaderSearch() {
  const t = useTranslations("Catalog");
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("searchLabel")}
        title={t("searchLabel")}
        className="grid size-11 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-muted"
        data-testid="header-search-button"
      >
        <Search className="size-5.5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="z-50 w-[min(30rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-3 shadow-popover">
          <HeaderSearchForm autoFocus />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
