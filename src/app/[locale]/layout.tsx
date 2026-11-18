import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Providers } from "@/components/layout/Providers";
import { AccountShopSync } from "@/features/account/AccountShopSync";
import { getCurrentUser } from "@/features/account/session";
import { currentSessionFingerprint } from "@/features/account/session-order";
import { CartDrawer } from "@/features/cart/CartDrawer";
import { MarketProvider } from "@/features/markets/MarketContext";
import { BottomNav } from "@/components/layout/BottomNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader, UtilityBar } from "@/components/layout/SiteHeader";
import { toNavCategories } from "@/components/layout/nav-types";
import { getCategoryTree } from "@/features/catalog/api";
import { resolveMarket } from "@/features/markets/api";
import { getSupportEmail } from "@/features/settings/api";
import { siteFont } from "@/lib/fonts";
import { localeDirection, routing } from "@/lib/i18n/routing";
import { robotsFor } from "@/lib/seo/metadata";
import { seoConfig } from "@/lib/seo/site";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
  colorScheme: "light dark",
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const requested = (await params).locale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    metadataBase: new URL(seoConfig.siteUrl),
    title: { default: t("homeTitle"), template: t("titleTemplate") },
    description: t("homeDescription"),
    applicationName: t("siteName"),
    robots: robotsFor(seoConfig),
    formatDetection: { telephone: false, address: false, email: false },
  };
}

/** Only these namespaces are used by client components; the rest stays on the server. */
const CLIENT_NAMESPACES = ["Common", "Header", "Hero", "Preferences", "Sections", "States", "Cart", "Wishlist", "Gallery", "Purchase", "Catalog", "Auth", "Account", "Checkout", "Designers"] as const;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [t, messages] = await Promise.all([getTranslations("Common"), getMessages()]);
  const clientMessages = Object.fromEntries(CLIENT_NAMESPACES.map((ns) => [ns, messages[ns]]));
  const market = await resolveMarket(locale);
  const tree = await getCategoryTree(locale, market.code);
  const departments = tree.ok ? toNavCategories(tree.data) : [];
  const [current, supportEmail, session] = await Promise.all([getCurrentUser(locale), getSupportEmail(locale), currentSessionFingerprint()]);
  const account =
    current.status === "signed_in"
      ? { firstName: current.user.name.trim().split(/\s+/)[0] || current.user.name, verified: !!current.user.email_verified_at }
      : null;

  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={siteFont.variable}
      suppressHydrationWarning
    >
      <body
        className="flex min-h-dvh flex-col"
        data-account={current.status === "signed_in" ? "1" : "0"}
        // Which session this page was rendered for (one-way fingerprint): cart/wishlist writes carry it.
        data-session={current.status === "signed_in" && session ? session : undefined}
      >
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>
           <MarketProvider market={market.code}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-foreground"
            >
              {t("skipToContent")}
            </a>
            <UtilityBar markets={market.markets} market={market.code} supportEmail={supportEmail} />
            <SiteHeader departments={departments} markets={market.markets} market={market.code} account={account} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter departments={departments} market={market.current} supportEmail={supportEmail} />
            <BottomNav signedIn={current.status === "signed_in"} />
            <CartDrawer />
            <AccountShopSync signedIn={current.status === "signed_in"} />
           </MarketProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
