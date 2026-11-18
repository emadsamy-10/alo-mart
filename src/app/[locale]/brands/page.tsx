import type { Metadata } from "next";
import { Tag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { getBrands } from "@/features/catalog/api";
import { BrandTile } from "@/features/catalog/BrandTile";
import { CatalogUnavailableError } from "@/lib/api/errors";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/brands">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Brand" });
  return pageMetadata({ locale, path: "/brands", title: t("all"), description: t("allDescription") });
}

/** Every brand the API publishes. Each tile opens that brand's real product listing. */
export default async function BrandsPage({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tc, brands] = await Promise.all([getTranslations("Brand"), getTranslations("Common"), getBrands(locale)]);
  if (!brands.ok) throw new CatalogUnavailableError(brands.error.kind);

  return (
    <Container className="pt-5 pb-12 sm:pt-7">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          { name: t("all"), url: localizedUrl(seoConfig.siteUrl, locale, "/brands") },
        ])}
      />
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("all") }]} />
      <h1 className="tracking-display mt-3 mb-2 text-[1.75rem] leading-tight font-extrabold sm:text-[2.25rem]">{t("all")}</h1>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground sm:text-base">{t("allDescription")}</p>
      {brands.data.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6" data-testid="brands">
          {brands.data.map((brand) => (
            <li key={brand.id}>
              <BrandTile name={brand.name} slug={brand.slug} logo={brand.logo} />
            </li>
          ))}
        </ul>
      ) : (
        <StatusPanel icon={<Tag className="size-6" />} title={t("noneTitle")} body={t("noneBody")} />
      )}
    </Container>
  );
}
