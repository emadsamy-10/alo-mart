"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils/cn";

/**
 * Site-wide product search: a plain GET form to the catalog (`/products?q=`),
 * so it works before hydration and the results page is the real,
 * server-rendered catalog search.
 */
export function HeaderSearchForm({ className, autoFocus = false }: { className?: string; autoFocus?: boolean }) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  return (
    <form action={`/${locale}/products`} method="get" role="search" className={cn("flex items-center gap-2", className)} data-testid="header-search">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">{t("searchLabel")}</span>
        <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4.5 text-muted-foreground" aria-hidden />
        <input
          type="search"
          name="q"
          required
          minLength={2}
          maxLength={100}
          autoFocus={autoFocus}
          enterKeyHint="search"
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-full border border-border bg-surface ps-10 pe-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground/70 focus:border-brand focus:outline-none"
        />
      </label>
      <button type="submit" className="inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-5 text-sm font-semibold text-ink-foreground hover:bg-ink/90">
        {t("searchSubmit")}
      </button>
    </form>
  );
}

/** Desktop header: a round search button (same style as wishlist/cart) opening the search form. */
export function HeaderSearch() {
  const t = useTranslations("Catalog");
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("searchLabel")}
        title={t("searchLabel")}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:border-border-strong"
        data-testid="header-search-button"
      >
        <Search className="size-5" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="z-50 w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-3 shadow-popover">
          <HeaderSearchForm autoFocus />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
