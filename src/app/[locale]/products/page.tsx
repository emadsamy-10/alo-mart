import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowDownWideNarrow, PackageSearch, X } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { Pagination } from "@/components/shared/Pagination";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { findCategory, getBrands, getCategoryTree, getStores } from "@/features/catalog/api";
import { FilterPanel } from "@/features/catalog/FilterPanel";
import { catalogQuery, isFiltered, parseCatalogParams, withFilter, withPage, type CatalogState, type FilterKey } from "@/features/catalog/filters";
import { MobileFilterSheet } from "@/features/catalog/MobileFilterSheet";
import { resolveMarket } from "@/features/markets/api";
import { getProducts } from "@/features/products/api";
import { ProductCard } from "@/features/products/ProductCard";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { defaultOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/products">;

const PER_PAGE = 24;

/** Resolve URL slugs to API ids against the real taxonomy; unknown slugs are dropped. */
async function load(locale: Locale, state: CatalogState) {
  const market = await resolveMarket(locale);
  const [tree, brands, stores] = await Promise.all([getCategoryTree(locale, market.code), getBrands(locale), getStores(locale)]);
  if (!tree.ok) throw new CatalogUnavailableError(tree.error.kind);

  const category = state.category ? findCategory(tree.data, state.category) : null;
  const brand = brands.ok && state.brand ? (brands.data.find((b) => b.slug === state.brand) ?? null) : null;
  const store = stores.ok && state.store ? (stores.data.items.find((s) => s.slug === state.store) ?? null) : null;
  const effective: CatalogState = { category: category?.node.slug ?? null, brand: brand?.slug ?? null, store: store?.slug ?? null, page: state.page };

  const products = await getProducts(locale, market.code, {
    categoryId: category?.node.id,
    brandId: brand?.id,
    storeId: store?.id,
    page: state.page,
    perPage: PER_PAGE,
  });
  if (!products.ok) throw new CatalogUnavailableError(products.error.kind);

  return {
    tree: tree.data,
    brands: brands.ok ? brands.data : [],
    stores: stores.ok ? stores.data.items : [],
    category,
    brand,
    store,
    state: effective,
    products: products.data,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const state = parseCatalogParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "Catalog" });
  // Index policy: the unfiltered listing (and its pages) only. Every filter or
  // sort combination is noindex,follow — category and brand pages are the
  // indexable landing pages for those facets, so no thin duplicates.
  const filtered = isFiltered(state);
  return pageMetadata({
    locale,
    path: "/products",
    page: filtered ? undefined : state.page,
    title: state.page > 1 && !filtered ? t("pageTitle", { page: state.page }) : t("title"),
    description: t("metaDescription"),
    image: defaultOgImage(t("title")),
    noindex: filtered,
  });
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const requested = parseCatalogParams(await searchParams);
  const data = await load(locale, requested);
  const { state, products, category, brand, store } = data;
  const [t, tc] = await Promise.all([getTranslations("Catalog"), getTranslations("Common")]);
  const filtered = isFiltered(state);
  const { items, meta } = products;
  // A page past the end is not a real page.
  if (state.page > 1 && items.length === 0) notFound();

  const chips: { key: FilterKey; label: string }[] = [
    ...(category ? [{ key: "category" as const, label: category.node.name }] : []),
    ...(brand ? [{ key: "brand" as const, label: brand.name }] : []),
    ...(store ? [{ key: "store" as const, label: store.name }] : []),
  ];
  const heading = category?.node.name ?? brand?.name ?? store?.name ?? t("title");
  const filterQuery = catalogQuery(withPage(state, 1));

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          { name: t("title"), url: localizedUrl(seoConfig.siteUrl, locale, "/products") },
        ])}
      />
      <Container className="pt-5 sm:pt-7">
        <Breadcrumbs items={[{ name: tc("home"), href: "/" }, filtered ? { name: t("title"), href: "/products" } : { name: t("title") }]} />

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="tracking-display text-[1.875rem] leading-tight font-extrabold sm:text-[2.5rem]">{heading}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground sm:text-base" data-testid="result-count" aria-live="polite">
              {t("results", { count: meta.total })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <MobileFilterSheet activeCount={chips.length}>
              <FilterPanel state={state} tree={data.tree} brands={data.brands} stores={data.stores} mode="form" />
            </MobileFilterSheet>
            {/* The API offers one ordering today; we show it instead of a selector with options that would not work. */}
            <p className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm" title={t("sortNote")}>
              <ArrowDownWideNarrow className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">{t("sortLabel")}:</span>
              <span className="font-bold">{t("sortNewest")}</span>
            </p>
          </div>
        </div>

        {chips.length ? (
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label={t("activeFilters")} role="group">
            {chips.map((chip) => (
              <Link
                key={chip.key}
                href={{ pathname: "/products", query: catalogQuery(withFilter(state, chip.key, null)) }}
                aria-label={t("removeFilter", { name: chip.label })}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink ps-4 pe-3 text-sm font-semibold text-ink-foreground transition hover:bg-ink/90"
                data-testid="filter-chip"
              >
                {chip.label}
                <X className="size-4" aria-hidden />
              </Link>
            ))}
            <Link href="/products" className="inline-flex h-10 items-center px-3 text-sm font-semibold text-brand-text hover:underline">
              {t("clearAll")}
            </Link>
          </div>
        ) : null}
      </Container>

      <Container className="grid gap-8 pt-6 pb-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <aside aria-label={t("filtersHeading")} className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1rem)] max-h-[calc(100dvh-var(--header-height)-2rem)] overflow-y-auto rounded-panel bg-surface px-3 pb-3 shadow-card ring-1 ring-border/70">
            <h2 className="px-2.5 pt-5 text-base font-extrabold">{t("filtersHeading")}</h2>
            <FilterPanel state={state} tree={data.tree} brands={data.brands} stores={data.stores} mode="links" />
          </div>
        </aside>

        <section aria-labelledby="catalog-products" className="min-w-0">
          <h2 id="catalog-products" className="sr-only">
            {t("productsHeading")}
          </h2>

          {category?.node.children.length ? (
            <div className="mb-6 rounded-card bg-surface-muted p-4">
              <p className="text-sm text-muted-foreground">{t("directOnly", { name: category.node.name })}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {category.node.children.map((child) => (
                  <li key={child.slug}>
                    <Link
                      href={{ pathname: "/products", query: catalogQuery(withFilter(state, "category", child.slug)) }}
                      className="inline-flex h-10 items-center rounded-full border border-border bg-surface px-4 text-sm font-semibold hover:border-ink"
                    >
                      {child.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {items.length ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-5 min-[90rem]:grid-cols-4" data-testid="catalog-grid">
                {items.map((product, index) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      priority={index < 2}
                      sizes="(min-width: 1440px) 19vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, 48vw"
                    />
                  </li>
                ))}
              </ul>
              <Pagination path="/products" page={meta.current_page} lastPage={meta.last_page} query={filterQuery} />
            </>
          ) : (
            <StatusPanel
              icon={<PackageSearch className="size-6" />}
              title={filtered ? t("emptyTitle") : t("marketEmptyTitle")}
              body={filtered ? t("emptyBody") : t("marketEmptyBody")}
              action={
                filtered ? (
                  <Link href="/products" className={buttonClass({ variant: "primary" })}>
                    {t("clearFilters")}
                  </Link>
                ) : null
              }
            />
          )}
        </section>
      </Container>
    </>
  );
}
