import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { Pagination, parsePage } from "@/components/shared/Pagination";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { getBrand } from "@/features/catalog/api";
import { resolveMarket } from "@/features/markets/api";
import { getProducts } from "@/features/products/api";
import { ProductGrid } from "@/features/products/ProductGrid";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { listingOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/brands/[slug]">;

async function load(locale: Locale, slug: string, page: number) {
  const market = await resolveMarket(locale);
  const brand = await getBrand(locale, slug);
  const products = brand.ok ? await getProducts(locale, market.code, { brandId: brand.data.id, page }) : null;
  return { brand, products };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const page = parsePage((await searchParams).page);
  const { brand, products } = await load(locale, slug, page);
  if (!brand.ok) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return pageMetadata({
    locale,
    path: `/brands/${brand.data.slug}`,
    page,
    title: brand.data.meta_title || brand.data.name,
    description: brand.data.meta_description || brand.data.description || t("brandDescription", { name: brand.data.name }),
    image: listingOgImage(brand.data.logo, products?.ok ? products.data.items[0] : undefined, brand.data.name),
    noindex: !(products?.ok && products.data.items.length > 0),
  });
}

/** Minimal brand page: identity + the brand's products in the current market. */
export default async function BrandPage({ params, searchParams }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);
  const { brand, products } = await load(locale, slug, page);
  const [t, tc] = await Promise.all([getTranslations("Brand"), getTranslations("Common")]);

  if (!brand.ok) {
    if (brand.error.kind === "not_found") notFound();
    throw new CatalogUnavailableError(brand.error.kind);
  }
  // Outage (not "not found") → 500 via the error boundary, so crawlers retry instead of indexing an error.
  if (products && !products.ok) throw new CatalogUnavailableError(products.error.kind);

  const b = brand.data;
  const items = products?.ok ? products.data.items : [];
  if (page > 1 && products?.ok && items.length === 0) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          { name: b.name, url: localizedUrl(seoConfig.siteUrl, locale, `/brands/${b.slug}`) },
        ])}
      />
      <Container className="pt-6 pb-4 sm:pt-8">
        <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: b.name }]} />
        <div className="mt-5 flex items-center gap-5">
          <span className="w-24 shrink-0 overflow-hidden rounded-card bg-white shadow-card ring-1 ring-border sm:w-28">
            <AppImage src={b.logo} alt={b.name} ratio="1/1" fit="contain" sizes="112px" priority className="p-3" />
          </span>
          <div className="min-w-0">
            <h1 className="tracking-display text-3xl font-extrabold text-balance sm:text-4xl">{b.name}</h1>
            {b.description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{b.description}</p> : null}
          </div>
        </div>
      </Container>

      <Container as="section" aria-labelledby="brand-products" className="py-6">
        <h2 id="brand-products" className="tracking-display mb-5 text-xl font-bold">
          {t("products", { name: b.name })}
        </h2>
        {items.length ? (
          <>
            <ProductGrid products={items} />
            {products?.ok ? <Pagination path={`/brands/${b.slug}`} page={products.data.meta.current_page} lastPage={products.data.meta.last_page} /> : null}
          </>
        ) : (
          <StatusPanel icon={<PackageOpen className="size-6" />} title={t("empty", { name: b.name })} body={t("emptyHint")} />
        )}
      </Container>
    </>
  );
}
