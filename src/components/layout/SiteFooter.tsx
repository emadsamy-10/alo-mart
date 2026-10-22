import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { currencyName } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import type { MarketOption } from "@/features/markets/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import type { NavCategory } from "./nav-types";

/**
 * Navy footer (approved design) with only facts we have: the brand, real
 * department and category links, the current market, and language. No
 * invented addresses, policies, newsletter, app badges or social accounts.
 */
export async function SiteFooter({ departments, market }: { departments: NavCategory[]; market: MarketOption | null }) {
  const [t, tp, locale] = await Promise.all([getTranslations("Footer"), getTranslations("Preferences"), getLocale()]);
  const year = new Date().getFullYear();
  const popular = departments.flatMap((d) => d.children).slice(0, 8);

  const linkClass = "inline-flex min-h-11 items-center lg:min-h-9 text-sm text-footer-muted transition-colors hover:text-footer-foreground";
  const headingClass = "mb-3 text-[0.9375rem] font-bold text-footer-foreground";

  return (
    <footer className="mt-10 bg-footer text-footer-foreground sm:mt-12">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 sm:py-14 lg:grid-cols-[1.35fr_1fr_1fr_1fr] lg:gap-12">
        <div className="max-w-sm">
          <Logo tone="footer" />
          <p className="mt-5 text-sm leading-relaxed text-footer-muted">{t("tagline")}</p>
          {market ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-footer-border px-4 py-2 text-[0.8125rem] text-footer-foreground">
              {t("market", { market: market.name, currency: currencyName(market.currencyCode, locale) })}
            </p>
          ) : null}
        </div>

        {departments.length ? (
          <nav aria-labelledby="footer-departments">
            <h2 id="footer-departments" className={headingClass}>
              {t("departments")}
            </h2>
            <ul>
              {departments.map((d) => (
                <li key={d.slug}>
                  <Link href={`/categories/${d.slug}`} className={linkClass}>
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {popular.length ? (
          <nav aria-labelledby="footer-popular">
            <h2 id="footer-popular" className={headingClass}>
              {t("popular")}
            </h2>
            <ul>
              {popular.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} className={linkClass}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div>
          <h2 className={headingClass}>{tp("language")}</h2>
          <LanguageSwitcher variant="list" tone="footer" />
        </div>
      </Container>
      <div className="border-t border-footer-border">
        <Container className="flex min-h-14 items-center py-4 text-xs text-footer-muted">{t("copyright", { year })}</Container>
      </div>
    </footer>
  );
}
