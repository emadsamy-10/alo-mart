import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

interface PaginationProps {
  path: string;
  page: number;
  lastPage: number;
  /** Other query parameters to keep (e.g. active filters). Never include `page`. */
  query?: Record<string, string>;
}

/** Page numbers to show: first, last, and a window around the current page. */
export function pageWindow(page: number, lastPage: number): (number | "gap")[] {
  const pages = new Set([1, lastPage, page - 1, page, page + 1].filter((p) => p >= 1 && p <= lastPage));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

/** Crawlable pagination links (?page=N, filters preserved). Page 1 is the bare URL. */
export async function Pagination({ path, page, lastPage, query = {} }: PaginationProps) {
  if (lastPage <= 1) return null;
  const t = await getTranslations("Common");
  const href = (p: number) => ({ pathname: path, query: p <= 1 ? query : { ...query, page: String(p) } });
  const control = "grid size-11 place-items-center rounded-full border border-border-strong bg-surface transition hover:border-ink";

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
                  "grid size-11 place-items-center rounded-full text-sm font-bold tabular-nums transition",
                  p === page ? "bg-ink text-ink-foreground" : "hover:bg-surface-muted",
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
