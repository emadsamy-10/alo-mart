"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { locales, type Locale } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Real links to the same page in the other locale(s) — crawlable, work
 * without JS, keep the current path. With two locales it is a single toggle.
 */
export function LanguageSwitcher({
  className,
  variant = "compact",
  tone = "default",
}: {
  className?: string;
  variant?: "compact" | "list";
  /** "footer" for the navy footer band. */
  tone?: "default" | "footer";
}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("Preferences");
  const others = locales.filter((l) => l !== locale);

  if (variant === "list") {
    return (
      <ul className={cn("flex flex-wrap gap-2", className)}>
        {locales.map((l) => (
          <li key={l}>
            <Link
              href={pathname}
              locale={l}
              hrefLang={l}
              aria-current={l === locale ? "true" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors",
                tone === "footer"
                  ? l === locale
                    ? "border-footer-foreground bg-footer-foreground text-footer"
                    : "border-footer-border text-footer-foreground hover:border-footer-muted"
                  : l === locale
                    ? "border-ink bg-ink text-ink-foreground"
                    : "border-border-strong text-foreground hover:bg-surface-muted",
              )}
            >
              <span lang={l}>{t(`languages.${l}`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <>
      {others.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          hrefLang={l}
          aria-label={t("changeLanguage", { language: t(`languages.${locale}`) })}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-semibold text-foreground transition-colors hover:bg-surface",
            className,
          )}
        >
          <Languages className="size-4 text-muted-foreground" aria-hidden />
          <span lang={l}>{t(`languages.${l}`)}</span>
        </Link>
      ))}
    </>
  );
}
