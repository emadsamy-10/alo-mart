import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { AppImage } from "@/components/shared/AppImage";
import { cn } from "@/lib/utils/cn";

/**
 * The official ALO MART artwork (bag mark above a wordmark, from the Admin
 * project) cropped to the bag mark, with the wordmark set in type beside it.
 * The approved mockup's house mark is conceptual — keep this asset until the
 * business supplies a replacement file. Never redraw the mark.
 */
export function Logo({
  className,
  tone = "default",
}: {
  className?: string;
  tone?: "default" | "footer";
}) {
  const t = useTranslations("Common");
  return (
    <Link href="/" className={cn("group inline-flex min-w-0 items-center gap-3 rounded-xl", className)} aria-label={t("brandName")}>
      <span className="relative block size-11 shrink-0 overflow-hidden rounded-[0.85rem] bg-brand shadow-sm lg:size-12">
        <AppImage src="/brand/alo-mart-logo.jpeg" alt="" ratio="1/1" sizes="96px" priority className="origin-[50%_30%] scale-[1.8]" />
      </span>
      {/* Below 360px the bag mark stands alone rather than truncating the name. */}
      <span className="hidden min-w-0 min-[360px]:block">
        <span
          className={cn(
            "text-xl leading-none font-extrabold whitespace-nowrap sm:text-[1.5rem] lg:text-[1.75rem]",
            tone === "footer" ? "text-footer-foreground" : "text-brand-text",
          )}
        >
          {t("brandName")}
        </span>
      </span>
    </Link>
  );
}
