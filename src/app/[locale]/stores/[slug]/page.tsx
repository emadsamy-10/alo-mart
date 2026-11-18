import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe, Mail, PackageOpen, Phone } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { Pagination, parsePage } from "@/components/shared/Pagination";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { getStore } from "@/features/catalog/api";
import { resolveMarket } from "@/features/markets/api";
import { getProducts } from "@/features/products/api";
import { ProductGrid } from "@/features/products/ProductGrid";
import type { Locale } from "@/lib/i18n/routing";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl } from "@/lib/seo/metadata";
import { listingOgImage, pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/stores/[slug]">;

async function load(locale: Locale, slug: string, page: number) {
  const market = await resolveMarket(locale);
  const store = await getStore(locale, slug);
  const products = store.ok ? await getProducts(locale, market.code, { storeId: store.data.id, page }) : null;
  return { store, products };
}

/** Only http(s) links from merchant data are rendered as links. */
function safeWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const page = parsePage((await searchParams).page);
  const { store, products } = await load(locale, slug, page);
  if (!store.ok) return {};
  const t = await getTranslations({ locale, namespace: "Store" });
  return pageMetadata({
    locale,
    path: `/stores/${store.data.slug}`,
    page,
    title: store.data.name,
    description: store.data.description || t("metaDescription", { name: store.data.name }),
    image: listingOgImage(store.data.logo ?? null, products?.ok ? products.data.items[0] : undefined, store.data.name),
    noindex: !(products?.ok && products.data.items.length > 0),
  });
}

/** A store's public profile, its own policies and its products in the current market. */
export default async function StorePage({ params, searchParams }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const page = parsePage((await searchParams).page);
  const { store, products } = await load(locale, slug, page);
  const [t, tc] = await Promise.all([getTranslations("Store"), getTranslations("Common")]);

  if (!store.ok) {
    if (store.error.kind === "not_found") notFound();
    throw new CatalogUnavailableError(store.error.kind);
  }
  if (products && !products.ok) throw new CatalogUnavailableError(products.error.kind);

  const s = store.data;
  const items = products?.ok ? products.data.items : [];
  if (page > 1 && products?.ok && items.length === 0) notFound();
  const website = safeWebsite(s.website);
  const policies = s.policies.filter((p) => p.title && p.content);

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
          { name: t("all"), url: localizedUrl(seoConfig.siteUrl, locale, "/stores") },
          { name: s.name, url: localizedUrl(seoConfig.siteUrl, locale, `/stores/${s.slug}`) },
        ])}
      />
      <Container className="pt-6 pb-4 sm:pt-8">
        <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("all"), href: "/stores" }, { name: s.name }]} />
        {s.cover_image ? (
          <div className="mt-5 overflow-hidden rounded-panel bg-image-well">
            <AppImage src={s.cover_image} alt="" ratio="4/1" sizes="(min-width: 1280px) 1200px, 100vw" priority />
          </div>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-5">
          {s.logo ? (
            <span className="w-24 shrink-0 overflow-hidden rounded-card bg-white shadow-card ring-1 ring-border sm:w-28">
              <AppImage src={s.logo} alt={s.name} ratio="1/1" fit="contain" sizes="112px" className="p-3" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h1 className="tracking-display text-2xl font-extrabold break-words text-balance min-[360px]:text-3xl sm:text-4xl">{s.name}</h1>
            {s.description ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{s.description}</p> : null}
            {s.contact_email || s.contact_phone || website ? (
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label={t("contact")}>
                {s.contact_email ? (
                  <li>
                    <a href={`mailto:${s.contact_email}`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-text hover:underline">
                      <Mail className="size-4" aria-hidden />
                      {s.contact_email}
                    </a>
                  </li>
                ) : null}
                {s.contact_phone ? (
                  <li>
                    <a href={`tel:${s.contact_phone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-text hover:underline" dir="ltr">
                      <Phone className="size-4" aria-hidden />
                      {s.contact_phone}
                    </a>
                  </li>
                ) : null}
                {website ? (
                  <li>
                    <a href={website} rel="noopener noreferrer nofollow" target="_blank" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-text hover:underline">
                      <Globe className="size-4" aria-hidden />
                      {t("website")}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </Container>

      <Container as="section" aria-labelledby="store-products" className="py-6">
        <h2 id="store-products" className="tracking-display mb-5 text-xl font-bold">
          {t("products", { name: s.name })}
        </h2>
        {items.length ? (
          <>
            <ProductGrid products={items} />
            {products?.ok ? <Pagination path={`/stores/${s.slug}`} page={products.data.meta.current_page} lastPage={products.data.meta.last_page} /> : null}
          </>
        ) : (
          <StatusPanel icon={<PackageOpen className="size-6" />} title={t("empty", { name: s.name })} body={t("emptyHint")} />
        )}
      </Container>

      {policies.length ? (
        <Container as="section" aria-labelledby="store-policies" className="pb-10">
          <h2 id="store-policies" className="tracking-display mb-4 text-xl font-bold">
            {t("policies")}
          </h2>
          <div className="space-y-3">
            {policies.map((p) => (
              <details key={p.code} className="group rounded-panel border border-border bg-surface px-5 shadow-card">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {p.title}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                    +
                  </span>
                </summary>
                {/* Merchant text: rendered as plain text (React escapes it), line breaks kept. */}
                <p className="pb-5 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{p.content}</p>
              </details>
            ))}
          </div>
        </Container>
      ) : null}
    </>
  );
}
