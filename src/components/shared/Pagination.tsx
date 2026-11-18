import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { pageWindow } from "./page-window";

export { pageWindow };

interface PaginationProps {
  path: string;
  page: number;
  lastPage: number;
  /** Other query parameters to keep (e.g. active filters). Never include `page`. */
  query?: Record<string, string>;
}

/** Crawlable pagination links (?page=N, filters preserved). Page 1 is the bare URL. */
export async function Pagination({ path, page, lastPage, query = {} }: PaginationProps) {
  if (lastPage <= 1) return null;
  const t = await getTranslations("Common");
  const href = (p: number) => ({ pathname: path, query: p <= 1 ? query : { ...query, page: String(p) } });
  const control = "grid size-11 place-items-center rounded-xl border border-border bg-surface shadow-sm transition-colors hover:border-border-strong";

  return (
    <nav aria-label={t("pagination")} className="mt-12 flex flex-col items-center gap-3">
      <ul className="flex items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={control} aria-label={t("previousPage")}>
              <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
        </li>
        {pageWindow(page, lastPage).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={href(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={t("goToPage", { page: p })}
                className={cn(
                  "grid size-11 place-items-center rounded-xl text-sm font-bold tabular-nums transition-colors",
                  p === page ? "bg-brand text-brand-foreground shadow-sm" : "border border-border bg-surface shadow-sm hover:border-border-strong",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < lastPage ? (
            <Link href={href(page + 1)} rel="next" className={control} aria-label={t("nextPage")}>
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </Link>
          ) : null}
        </li>
      </ul>
      <p className="text-sm text-muted-foreground tabular-nums">{t("page", { page, total: lastPage })}</p>
    </nav>
  );
}

/** Parse ?page= defensively: anything invalid is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(page) && page > 1 && page < 10_000 ? page : 1;
}
