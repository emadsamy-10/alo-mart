import type { Metadata } from "next";
import { PackageOpen, WifiOff } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { MarketSwitcher } from "@/components/layout/MarketSwitcher";
import { toNavCategories } from "@/components/layout/nav-types";
import { getCategoryTree } from "@/features/catalog/api";
import { getHomepage } from "@/features/homepage/api";
import { Hero } from "@/features/homepage/Hero";
import { pickHeroContent } from "@/features/homepage/hero-content";
import { DEPARTMENTS_ANCHOR, SectionRenderer } from "@/features/homepage/SectionRenderer";
import { resolveMarket } from "@/features/markets/api";
import type { Locale } from "@/lib/i18n/routing";
import { localizedUrl } from "@/lib/seo/metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld";
import { defaultOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return pageMetadata({
    locale,
    path: "/",
    title: t("homeTitle"),
    description: t("homeDescription"),
    absoluteTitle: true,
    image: defaultOgImage(t("siteName")),
  });
}

/**
 * Homepage — fully server-rendered (no client fetching): crawlers receive the
 * hero, every merchandising section and all product links in the HTML.
 * Rendered per request because the market comes from a cookie; API data is
 * served from Next's data cache (see docs/architecture.md → Caching).
 */
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  const market = await resolveMarket(locale);
  const [homepage, tree, t, tm] = await Promise.all([
    getHomepage(locale, market.code),
    getCategoryTree(locale, market.code),
    getTranslations("States"),
    getTranslations("Metadata"),
  ]);
  const departments = tree.ok ? toNavCategories(tree.data) : [];
  const sections = homepage.ok ? homepage.data.sections : [];
  const heroContent = pickHeroContent(sections, departments);
  // "Browse departments" scrolls to the Admin's category tiles when present, else opens the first department.
  const browseHref = sections.some((s) => s.kind === "category")
    ? `#${DEPARTMENTS_ANCHOR}`
    : departments[0]
      ? `/categories/${departments[0].slug}`
      : null;

  return (
    <>
      <JsonLd
        data={[
          organizationJsonLd({
            siteUrl: seoConfig.siteUrl,
            name: tm("siteName"),
            logoUrl: `${seoConfig.siteUrl}/brand/alo-mart-logo.jpeg`,
          }),
          websiteJsonLd({
            siteUrl: seoConfig.siteUrl,
            name: tm("siteName"),
            url: localizedUrl(seoConfig.siteUrl, locale, "/"),
            locale,
          }),
        ]}
      />

      <Hero
        content={heroContent}
        departments={departments}
        currencyCode={market.current?.currencyCode ?? null}
        browseHref={browseHref}
      />

      {!homepage.ok ? (
        <Container className="py-10">
          <StatusPanel
            tone="error"
            icon={<WifiOff className="size-6" />}
            title={t("errorTitle")}
            body={t("errorBody")}
            action={
              <a href={`/${locale}`} className={buttonClass({ variant: "primary" })}>
                {t("retry")}
              </a>
            }
          />
        </Container>
      ) : homepage.data.sections.length === 0 ? (
        <Container className="py-10">
          <StatusPanel
            icon={<PackageOpen className="size-6" />}
            title={t("emptyHomeTitle", { market: market.current?.name ?? market.code })}
            body={t("emptyHomeBody")}
            action={<MarketSwitcher markets={market.markets} current={market.code} trigger="button" align="center" />}
          />
        </Container>
      ) : (
        <div className="pt-3 sm:pt-5">
          <SectionRenderer sections={homepage.data.sections} departments={departments} />
        </div>
      )}
    </>
  );
}
