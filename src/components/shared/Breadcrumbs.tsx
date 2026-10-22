import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export interface Crumb {
  name: string;
  /** Locale-less href; omitted for the current page. */
  href?: string;
}

/** Visible breadcrumb trail. Pair with breadcrumbJsonLd() for structured data. */
export async function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = await getTranslations("Product");
  return (
    <nav aria-label={t("breadcrumb")} className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-60 rtl:rotate-180" aria-hidden /> : null}
            {item.href ? (
              <Link href={item.href} className="-my-2.5 inline-flex min-h-10 items-center truncate transition-colors hover:text-foreground">
                {item.name}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-medium text-foreground">
                {item.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
