import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, Info, PackageSearch, SearchX } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { ActiveFilters } from "@/features/catalog/ActiveFilters";
import { getBrands, getCatalogFacets, getCatalogListing, getCategoryTree, getStores } from "@/features/catalog/api";
import { facetsQuery, listingQuery, rejectedAttributes, type ResolvedIds } from "@/features/catalog/api-query";
import { CatalogLink, CatalogNavigationProvider } from "@/features/catalog/CatalogNavigation";
import { CatalogPagination, CatalogResults, ResultCount } from "@/features/catalog/CatalogResults";
import { CatalogSearch } from "@/features/catalog/CatalogSearch";
import { FilterPanel } from "@/features/catalog/FilterPanel";
import { cleared, hasFilters, isFiltered, parseCatalogParams, withPage, withPatch, type CatalogState } from "@/features/catalog/filters";
import { MobileFilterSheet } from "@/features/catalog/MobileFilterSheet";
import { SortSelect, SortSheet } from "@/features/catalog/SortControl";
import { buildFilterLabels, buildFilterPanel, flattenTree } from "@/features/catalog/view-model";
import { resolveMarket } from "@/features/markets/api";
import { ProductCard } from "@/features/products/ProductCard";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { currencyLabel, isolate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { defaultOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/products">;

const PER_PAGE = 24;

/**
 * Resolve the URL's slugs to API ids against the real taxonomy (unknown
 * slugs are dropped), then load the page of results and the facets in
 * parallel — both requests describe the same matching set.
 */
async function load(locale: Locale, requested: CatalogState) {
  const market = await resolveMarket(locale);
  const [tree, brands, stores] = await Promise.all([getCategoryTree(locale, market.code), getBrands(locale), getStores(locale)]);
  if (!tree.ok) throw new CatalogUnavailableError(tree.error.kind);
  // Without these lists a chosen brand/store could not be told apart from a typo: fail rather than silently drop it.
  if (!brands.ok && requested.brands.length) throw new CatalogUnavailableError(brands.error.kind);
  if (!stores.ok && requested.stores.length) throw new CatalogUnavailableError(stores.error.kind);
  const brandList = brands.ok ? brands.data : [];
  const storeList = stores.ok ? stores.data.items : [];

  const categoryBySlug = new Map(flattenTree(tree.data).map((c) => [c.slug, c]));
  let state = withPatch(requested, {
    categories: requested.categories.filter((s) => categoryBySlug.has(s)),
    brands: requested.brands.filter((s) => brandList.some((b) => b.slug === s)),
    stores: requested.stores.filter((s) => storeList.some((b) => b.slug === s)),
    page: requested.page,
  });
  // include_descendants is meaningless unless a chosen category has children: drop it so the
  // URL state, the chips and the API request all agree.
  if (state.descendants && !state.categories.some((s) => categoryBySlug.get(s)!.children.length)) state = { ...state, descendants: false };
  const ids: ResolvedIds = {
    categoryIds: state.categories.map((s) => categoryBySlug.get(s)!.id),
    brandIds: state.brands.map((s) => brandList.find((b) => b.slug === s)!.id),
    storeIds: state.stores.map((s) => storeList.find((b) => b.slug === s)!.id),
  };

  const fetchBoth = (s: CatalogState) =>
    Promise.all([
      getCatalogListing(locale, listingQuery(market.code, s, ids, PER_PAGE)),
      getCatalogFacets(locale, facetsQuery(market.code, s, ids)),
    ]);
  let [listing, facets] = await fetchBoth(state);

  // An attribute that does not apply to the chosen categories (e.g. kept from a previous
  // category) is rejected with a 422: drop just those attributes, retry once, and say so.
  const rejected = [
    ...new Set([
      ...rejectedAttributes(listing.ok ? undefined : listing.error.errors),
      ...rejectedAttributes(facets.ok ? undefined : facets.error.errors),
    ]),
  ];
  if (rejected.length) {
    state = { ...state, attrs: Object.fromEntries(Object.entries(state.attrs).filter(([code]) => !rejected.includes(code))) };
    [listing, facets] = await fetchBoth(state);
  }

  return {
    market,
    tree: tree.data,
    brands: brandList,
    stores: storeList,
    state,
    listing,
    // Facets are an enhancement: if only they fail, the results still render.
    facets: facets.ok ? facets.data : null,
    removedAttributes: rejected,
  };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const state = parseCatalogParams(await searchParams);
  const t = await getTranslations({ locale, namespace: "Catalog" });
  // Index policy: the plain listing (and its pages) only. Any filter, search or sort is
  // noindex,follow with the canonical on /products — category and brand pages are the
  // indexable landing pages for those facets, so no thin or duplicate URLs get indexed.
  const filtered = isFiltered(state);
  return pageMetadata({
    locale,
    path: "/products",
    page: filtered ? undefined : state.page,
    title: state.q ? t("searchTitle", { term: state.q }) : state.page > 1 && !filtered ? t("pageTitle", { page: state.page }) : t("title"),
    description: t("metaDescription"),
    image: defaultOgImage(t("title")),
    noindex: filtered,
  });
}

export default async function ProductsPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const data = await load(locale, parseCatalogParams(await searchParams));
  const { state, listing, facets, market } = data;
  const [t, tc] = await Promise.all([getTranslations("Catalog"), getTranslations("Common")]);

  // Outage → error boundary (HTTP 500, retry). A 422 is the shopper's input → shown in place.
  if (!listing.ok && listing.error.kind !== "validation") throw new CatalogUnavailableError(listing.error.kind);

  const items = listing.ok ? listing.data.items : [];
  const meta = listing.ok ? listing.data.meta : null;
  const filtered = hasFilters(state);
  // The plain listing past its last page is not a page (SEO); a filtered one offers a way back.
  if (meta && state.page > 1 && items.length === 0 && !isFiltered(state)) notFound();

  const marketCurrency = market.current
    ? { code: market.current.currencyCode, decimal_places: market.current.currencyDecimals }
    : null;
  // Never guess a currency: without one from the API, prices show as plain numbers.
  const currency = items[0]?.currency ?? marketCurrency ?? { code: "", decimal_places: 2 };
  const panel = buildFilterPanel({
    state,
    tree: data.tree,
    facets,
    brands: data.brands,
    stores: data.stores,
    currency,
    currencyLabel: currency.code ? currencyLabel(currency.code, locale) : "",
  });
  const labels = buildFilterLabels({ tree: data.tree, brands: data.brands, stores: data.stores, facets });
  const total = meta?.total ?? 0;
  const singleCategory = state.categories.length === 1 ? labels.categories[state.categories[0]] : null;
  const heading = state.q ? t("searchHeading", { term: isolate(state.q) }) : (singleCategory ?? t("title"));

  const emptyActions = (
    <>
      {filtered ? (
        <CatalogLink to={cleared(state)} className={buttonClass({ variant: "primary" })} data-testid="empty-clear-filters">
          {t("clearFilters")}
        </CatalogLink>
      ) : null}
      {state.q ? (
        <CatalogLink to={withPatch(state, { q: null })} className={buttonClass({ variant: filtered ? "outline" : "primary" })}>
          {t("clearSearch")}
        </CatalogLink>
      ) : null}
    </>
  );

  return (
    <CatalogNavigationProvider state={state}>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          { name: t("title"), url: localizedUrl(seoConfig.siteUrl, locale, "/products") },
        ])}
      />
      <Container className="pt-4 sm:pt-6">
        <Breadcrumbs items={[{ name: tc("home"), href: "/" }, isFiltered(state) ? { name: t("title"), href: "/products" } : { name: t("title") }]} />

        <div className="mt-3">
          <div className="min-w-0">
            <h1 className="tracking-display text-[1.625rem] leading-tight font-extrabold text-balance sm:text-[2.125rem]" data-testid="catalog-heading">
              {heading}
            </h1>
            {state.q || singleCategory ? null : <p className="mt-1 hidden max-w-2xl text-sm text-pretty text-muted-foreground sm:block">{t("intro")}</p>}
          </div>
        </div>

        {data.removedAttributes.length ? (
          <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning" role="status" data-testid="removed-attributes">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("attributesRemoved")}
          </p>
        ) : null}
        {!facets ? (
          <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-surface-muted px-4 py-3 text-sm text-muted-foreground lg:hidden" role="status">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("facetsUnavailable")}
          </p>
        ) : null}
      </Container>

      <Container className="grid gap-5 pt-4 pb-4 sm:pt-5 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-7">
        <aside aria-label={t("filtersHeading")} className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height)+1rem)] max-h-[calc(100dvh-var(--header-height)-2rem)] overflow-y-auto overscroll-contain rounded-card bg-surface px-3 pb-3 shadow-card ring-1 ring-border/70">
            <h2 className="mx-2.5 border-b border-border pt-4 pb-3 text-base font-extrabold">{t("filtersHeading")}</h2>
            {facets ? (
              <FilterPanel data={panel} idPrefix="d" />
            ) : (
              <p className="mx-2.5 my-4 text-sm text-muted-foreground" data-testid="facets-unavailable">
                {t("facetsUnavailable")}
              </p>
            )}
            {filtered ? (
              <CatalogLink to={cleared(state)} className={buttonClass({ variant: "outline" }, "mt-2 w-full rounded-xl")} data-testid="sidebar-clear">
                {t("clearFilters")}
              </CatalogLink>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Count at the start, sort at the end; filter + sort buttons on phones. */}
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <ResultCount total={total} />
            <CatalogSearch className="order-last w-full lg:order-none lg:ms-auto lg:w-64 xl:w-80" />
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:min-w-80 lg:hidden">
              {facets ? <MobileFilterSheet data={panel} total={total} /> : null}
              <SortSheet />
            </div>
            <SortSelect className="hidden lg:flex" />
            <div className="w-full empty:hidden">
              <ActiveFilters labels={labels} currency={currency} />
            </div>
          </div>

          <CatalogResults page={state.page} heading={t("productsHeading")}>
          {!listing.ok ? (
            <StatusPanel
              tone="error"
              icon={<AlertTriangle className="size-6" />}
              title={t("invalidTitle")}
              body={listing.error.message ?? t("invalidBody")}
              action={
                <CatalogLink to={{ ...cleared(state), q: null, sort: null }} className={buttonClass({ variant: "primary" })}>
                  {t("resetCatalog")}
                </CatalogLink>
              }
            />
          ) : items.length ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-4 min-[90rem]:grid-cols-4" data-testid="catalog-grid">
                {items.map((product, index) => (
                  <li key={product.id}>
                    <ProductCard
                      product={product}
                      priority={index < 2}
                      sizes="(min-width: 1440px) 18vw, (min-width: 1024px) 24vw, (min-width: 768px) 31vw, 48vw"
                    />
                  </li>
                ))}
              </ul>
              {meta ? <CatalogPagination page={meta.current_page} lastPage={meta.last_page} /> : null}
            </>
          ) : meta && state.page > meta.last_page && total > 0 ? (
            <StatusPanel
              icon={<PackageSearch className="size-6" />}
              title={t("pageGoneTitle")}
              body={t("pageGoneBody", { last: meta.last_page })}
              action={
                <CatalogLink to={withPage(state, meta.last_page)} scroll className={buttonClass({ variant: "primary" })}>
                  {t("goToLastPage")}
                </CatalogLink>
              }
            />
          ) : (
            <StatusPanel
              icon={state.q ? <SearchX className="size-6" /> : <PackageSearch className="size-6" />}
              title={state.q && !filtered ? t("noSearchResultsTitle", { term: isolate(state.q) }) : filtered || state.q ? t("emptyTitle") : t("marketEmptyTitle")}
              body={state.q && !filtered ? t("noSearchResultsBody") : filtered || state.q ? t("emptyBody") : t("marketEmptyBody")}
              action={filtered || state.q ? emptyActions : null}
            />
          )}
          </CatalogResults>
        </div>
      </Container>
    </CatalogNavigationProvider>
  );
}
