import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { AppImage } from "@/components/shared/AppImage";
import { cn } from "@/lib/utils/cn";

/**
 * The official ALO MART artwork (bag mark above a wordmark, from the Admin
 * project) cropped to the bag mark, with the wordmark set in type beside it.
 * Never redraw the mark. `compact` is the mark alone, for the pinned row.
 */
export function Logo({
  className,
  tone = "default",
  compact = false,
}: {
  className?: string;
  tone?: "default" | "footer";
  compact?: boolean;
}) {
  const t = useTranslations("Common");
  const locale = useLocale();
  return (
    <Link href="/" className={cn("group inline-flex min-w-0 items-center gap-2.5 rounded-xl", className)} aria-label={compact ? t("brandName") : undefined}>
      <span className={cn("relative block shrink-0 overflow-hidden rounded-[0.8rem] bg-brand shadow-sm", compact ? "size-9" : "size-10 lg:size-12")}>
        <AppImage src="/brand/alo-mart-logo.jpeg" alt="" ratio="1/1" sizes="96px" priority className="origin-[50%_30%] scale-[1.8]" />
      </span>
      {compact ? null : (
        /* Below 360px the bag mark stands alone (the name stays for screen readers) rather than truncating. */
        <span className="flex min-w-0 flex-col max-[359px]:sr-only">
          <span
            className={cn(
              "text-xl leading-none font-extrabold whitespace-nowrap lg:text-[1.625rem]",
              tone === "footer" ? "text-footer-foreground" : "text-brand-text",
            )}
          >
            {t("brandName")}
          </span>
          {locale === "ar" ? (
            <span
              lang="en"
              dir="ltr"
              className={cn(
                "mt-1 text-end text-[0.625rem] leading-none font-semibold tracking-[0.22em] lg:text-[0.6875rem]",
                tone === "footer" ? "text-footer-muted" : "text-muted-foreground",
              )}
            >
              ALO MART
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}
