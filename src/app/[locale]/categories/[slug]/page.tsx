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
import { findCategory, getCategoryTree } from "@/features/catalog/api";
import { resolveMarket } from "@/features/markets/api";
import { getProducts } from "@/features/products/api";
import { ProductGrid } from "@/features/products/ProductGrid";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { listingOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/categories/[slug]">;

async function load(locale: Locale, slug: string, page: number) {
  const market = await resolveMarket(locale);
  const tree = await getCategoryTree(locale, market.code);
  if (!tree.ok) return { market, tree, location: null, products: null } as const;
  const location = findCategory(tree.data, slug);
  if (!location) return { market, tree, location: null, products: null } as const;
  const products = await getProducts(locale, market.code, { categoryId: location.node.id, page });
  return { market, tree, location, products } as const;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const page = parsePage((await searchParams).page);
  const { location, products } = await load(locale, slug, page);
  if (!location) return {};
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const { node } = location;
  const hasProducts = products?.ok && products.data.items.length > 0;

  return pageMetadata({
    locale,
    path: `/categories/${node.slug}`,
    page,
    title: node.metaTitle || node.name,
    description: node.metaDescription || t("categoryDescription", { name: node.name }),
    image: listingOgImage(node.imageUrl, products?.ok ? products.data.items[0] : undefined, node.name),
    // Thin-page policy: a category with nothing to show (no products, no sub-categories) is not indexed.
    noindex: !hasProducts && node.children.length === 0,
  });
}

/**
 * Minimal category landing page (Phase 1): sub-category navigation from the
 * real tree + products listed in this exact category. The API filters by
 * exact category, so parent departments say so instead of looking empty.
 */
export default async function CategoryPage({ params, searchParams }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);
  const { tree, location, products } = await load(locale, slug, page);
  const [t, tc] = await Promise.all([getTranslations("Category"), getTranslations("Common")]);

  // Outage (not "not found") → 500 via the error boundary, so crawlers retry instead of indexing an error.
  if (!tree.ok) throw new CatalogUnavailableError(tree.error.kind);
  if (products && !products.ok) throw new CatalogUnavailableError(products.error.kind);
  if (!location) notFound();

  const { node, trail } = location;
  const crumbs = [{ name: tc("home"), href: "/" }, ...trail.map((c, i) => (i === trail.length - 1 ? { name: c.name } : { name: c.name, href: `/categories/${c.slug}` }))];
  const items = products?.ok ? products.data.items : [];
  const meta = products?.ok ? products.data.meta : null;
  // Out-of-range pages are not real pages.
  if (page > 1 && products?.ok && items.length === 0) notFound();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          ...trail.map((c) => ({ name: c.name, url: localizedUrl(seoConfig.siteUrl, locale, `/categories/${c.slug}`) })),
        ])}
      />
      <Container className="pt-6 pb-4 sm:pt-8">
        <Breadcrumbs items={crumbs} />
        <div className="mt-5 flex items-center gap-5">
          {node.imageUrl ? (
            <span className="hidden w-24 shrink-0 overflow-hidden rounded-card bg-image-well shadow-card sm:block">
              <AppImage src={node.imageUrl} alt="" ratio="1/1" sizes="96px" priority />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="tracking-display text-3xl font-extrabold text-balance sm:text-4xl">{node.name}</h1>
            {meta && meta.total > 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">{t("productCount", { count: meta.total })}</p>
            ) : null}
          </div>
        </div>
      </Container>

      {node.children.length ? (
        <Container as="nav" aria-labelledby="subcategories" className="py-4">
          <h2 id="subcategories" className="sr-only">
            {t("subcategories")}
          </h2>
          <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {node.children.map((child) => (
              <li key={child.slug} className="shrink-0">
                <Link
                  href={`/categories/${child.slug}`}
                  className="inline-flex h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold shadow-sm transition-colors hover:border-ink hover:bg-ink hover:text-ink-foreground"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      ) : null}

      <Container as="section" aria-labelledby="category-products" className="py-6">
        <h2 id="category-products" className="sr-only">
          {t("products")}
        </h2>
        {items.length ? (
          <>
            {node.children.length ? <p className="mb-5 text-sm text-muted-foreground">{t("directOnly", { name: node.name })}</p> : null}
            <ProductGrid products={items} />
            {meta ? <Pagination path={`/categories/${node.slug}`} page={meta.current_page} lastPage={meta.last_page} /> : null}
          </>
        ) : node.children.length ? (
          <p className="rounded-card bg-surface-muted px-5 py-4 text-sm text-muted-foreground">{t("emptyDirect", { name: node.name })}</p>
        ) : (
          <StatusPanel icon={<PackageOpen className="size-6" />} title={t("empty", { name: node.name })} body={t("emptyHint")} />
        )}
      </Container>
    </>
  );
}
