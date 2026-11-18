"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";
import { pageWindow } from "@/components/shared/page-window";
import { cn } from "@/lib/utils/cn";
import { CatalogLink, useCatalog } from "./CatalogNavigation";
import { withPage } from "./filters";

/**
 * The server-rendered result grid, dimmed and marked busy while the next
 * filter set loads (the old cards stay readable, never mixed with new
 * counts). After a page change, the results' heading takes focus and is
 * scrolled into view, so keyboard and screen-reader users land on the new page.
 */
export function CatalogResults({ page, heading, children }: { page: number; heading: string; children: ReactNode }) {
  const { pending } = useCatalog();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(page);

  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    const el = headingRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, [page]);

  return (
    <section aria-labelledby="catalog-products" className="min-w-0">
      <h2
        id="catalog-products"
        ref={headingRef}
        tabIndex={-1}
        className="sr-only scroll-mt-[calc(var(--header-height)+1rem)] focus:outline-none"
      >
        {heading}
      </h2>
      <div
        aria-busy={pending || undefined}
        data-pending={pending || undefined}
        data-testid="catalog-results"
        className={cn("transition-opacity duration-(--duration-base)", pending && "pointer-events-none opacity-55")}
      >
        {children}
      </div>
    </section>
  );
}

/** Result count, announced politely; replaced by an "updating" state while loading. */
export function ResultCount({ total }: { total: number }) {
  const t = useTranslations("Catalog");
  const { pending } = useCatalog();
  return (
    <p className="flex min-h-6 items-center gap-2 text-sm font-semibold text-muted-foreground" aria-live="polite" data-testid="result-count">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("updating")}
        </>
      ) : (
        t("results", { count: total })
      )}
    </p>
  );
}

/** Server-side pagination: real ?page= links that keep every filter. */
export function CatalogPagination({ page, lastPage }: { page: number; lastPage: number }) {
  const t = useTranslations("Common");
  const { state } = useCatalog();
  if (lastPage <= 1) return null;
  const control = "grid size-11 place-items-center rounded-xl border border-border bg-surface shadow-sm transition-colors hover:border-border-strong";

  return (
    <nav aria-label={t("pagination")} className="mt-8 flex flex-col items-center gap-3 lg:mt-10" data-testid="pagination">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <li>
          {page > 1 ? (
            <CatalogLink to={withPage(state, page - 1)} rel="prev" className={control} aria-label={t("previousPage")}>
              <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            </CatalogLink>
          ) : null}
        </li>
        {pageWindow(page, lastPage).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <CatalogLink
                to={withPage(state, p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={t("goToPage", { page: p })}
                className={cn(
                  "grid size-11 place-items-center rounded-xl text-sm font-bold tabular-nums transition-colors",
                  p === page ? "bg-brand text-brand-foreground shadow-sm" : "border border-border bg-surface shadow-sm hover:border-border-strong",
                )}
              >
                {p}
              </CatalogLink>
            </li>
          ),
        )}
        <li>
          {page < lastPage ? (
            <CatalogLink to={withPage(state, page + 1)} rel="next" className={control} aria-label={t("nextPage")}>
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </CatalogLink>
          ) : null}
        </li>
      </ul>
      <p className="text-sm text-muted-foreground tabular-nums">{t("page", { page, total: lastPage })}</p>
    </nav>
  );
}
