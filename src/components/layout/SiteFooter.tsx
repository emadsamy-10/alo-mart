import { Headset } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { currencyName } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import type { MarketOption } from "@/features/markets/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import type { NavCategory } from "./nav-types";

/**
 * Navy footer with only facts we have: the brand, real department and shop
 * links, the account, the support email the platform publishes (`/settings`),
 * the current market, and language. Legal links, payment badges, app badges and
 * social accounts appear here only once they really exist.
 */
export async function SiteFooter({
  departments,
  market,
  supportEmail,
}: {
  departments: NavCategory[];
  market: MarketOption | null;
  supportEmail: string | null;
}) {
  const [t, tp, th, locale] = await Promise.all([getTranslations("Footer"), getTranslations("Preferences"), getTranslations("Header"), getLocale()]);
  const year = new Date().getFullYear();

  const linkClass = "inline-flex min-h-11 items-center text-sm text-footer-muted transition-colors hover:text-footer-foreground lg:min-h-9";
  const headingClass = "mb-3 text-sm font-extrabold text-footer-foreground";

  const shopLinks = [
    { href: "/products", label: t("allProducts") },
    { href: "/stores", label: t("stores") },
    { href: "/brands", label: th("brands") },
    { href: "/products?sort=newest", label: th("newArrivals") },
    { href: "/products?sort=best_selling", label: th("bestSellers") },
    { href: "/products?on_sale=1", label: th("offers") },
  ];
  const accountLinks = [
    { href: "/account", label: t("account") },
    { href: "/account/orders", label: t("orders") },
    { href: "/wishlist", label: th("wishlist") },
    { href: "/cart", label: th("cart") },
  ];

  return (
    <footer className="mt-8 bg-footer pb-[calc(3.75rem+env(safe-area-inset-bottom))] text-footer-foreground sm:mt-10 lg:pb-0">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:py-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.1fr] lg:gap-10 lg:py-14">
        <div className="col-span-2 max-w-sm lg:col-span-1">
          <Logo tone="footer" />
          <p className="mt-4 text-sm leading-relaxed text-footer-muted">{t("tagline")}</p>
          {market ? (
            <p className="mt-4 inline-flex items-center rounded-full border border-footer-border px-3.5 py-1.5 text-xs text-footer-foreground">
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

        <nav aria-labelledby="footer-shop">
          <h2 id="footer-shop" className={headingClass}>
            {t("shop")}
          </h2>
          <ul>
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-labelledby="footer-account">
          <h2 id="footer-account" className={headingClass}>
            {t("accountHeading")}
          </h2>
          <ul>
            {accountLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-7">
          {supportEmail ? (
            <div>
              <h2 className={headingClass}>{t("support")}</h2>
              <a href={`mailto:${supportEmail}`} className={`${linkClass} gap-2 break-all`} data-testid="footer-support-email">
                <Headset className="size-4 shrink-0" aria-hidden />
                {supportEmail}
              </a>
            </div>
          ) : null}
          <div>
            <h2 className={headingClass}>{tp("language")}</h2>
            <LanguageSwitcher variant="list" tone="footer" />
          </div>
        </div>
      </Container>
      <div className="border-t border-footer-border">
        <Container className="flex min-h-14 items-center py-4 text-xs text-footer-muted">{t("copyright", { year })}</Container>
      </div>
    </footer>
  );
}
