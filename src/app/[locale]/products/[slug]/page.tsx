import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { JsonLd } from "@/components/shared/JsonLd";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { resolveMarket } from "@/features/markets/api";
import { getProduct, getProducts, type ProductDetail, type ProductMedia } from "@/features/products/api";
import type { GalleryImage } from "@/features/products/gallery/types";
import { priceViewFromDetail } from "@/features/products/pricing";
import { ProductCard } from "@/features/products/ProductCard";
import { ProductSelectionProvider, type PurchasableProduct } from "@/features/products/purchase/ProductSelection";
import { PurchasePanel } from "@/features/products/purchase/PurchasePanel";
import { SelectedGallery } from "@/features/products/purchase/SelectedGallery";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { resolveImage } from "@/lib/images";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { localizedUrl, truncateDescription } from "@/lib/seo/metadata";
import { pageMetadata, seoConfig } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/products/[slug]">;

async function load(locale: Locale, slug: string) {
  const market = await resolveMarket(locale);
  return { market, result: await getProduct(locale, market.code, slug) };
}

/** Each display size gets its own rendition: thumbnails never download detail images. */
function toGallery(media: ProductMedia[], alt: string): GalleryImage[] {
  return [...media]
    .filter((m) => m.type === "image")
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
    .map((m) => {
      const source = { url: m.url, renditions: m.renditions, width: m.width_px, height: m.height_px };
      return {
        id: m.id,
        alt: m.alt_text || alt,
        thumb: resolveImage(source, "thumbnail")?.src ?? null,
        main: resolveImage(source, "detail")?.src ?? null,
        large: resolveImage(source, "large")?.src ?? null,
      };
    });
}

function toPurchasable(product: ProductDetail): PurchasableProduct {
  const gallery = toGallery(product.media, product.name);
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: gallery[0]?.thumb ?? null,
    currency: product.currency,
    gallery,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku ?? null,
      price: v.price,
      sale_price: v.sale_price,
      is_in_stock: v.is_in_stock,
      options: v.options,
      gallery: toGallery(v.media, product.name),
    })),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  const { result } = await load(locale, slug);
  if (!result.ok) return {};
  const product = result.data;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const primary = [...product.media].sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0];
  const og = primary ? resolveImage({ url: primary.url, renditions: primary.renditions, width: primary.width_px, height: primary.height_px }, "large") : null;
  const fallback = product.store?.name
    ? t("productDescriptionFallback", { name: product.name, store: product.store.name })
    : t("productDescriptionNoStore", { name: product.name });

  return pageMetadata({
    locale,
    path: `/products/${product.slug}`,
    title: product.meta_title || product.name,
    description: product.meta_description || product.description || fallback,
    image: og ? { url: og.src, width: og.width, height: og.height, alt: primary?.alt_text || product.name } : null,
  });
}

/**
 * Product details. Server-rendered for SEO (name, price for the default
 * option, description, specifications, breadcrumbs, related products,
 * JSON-LD); the gallery and the purchase panel are the only client islands.
 */
export default async function ProductPage({ params }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  const { market, result } = await load(locale, slug);

  if (!result.ok) {
    // 404 = unpublished, or not sold in this market. Anything else is an outage → 500 (error boundary).
    if (result.error.kind === "not_found") notFound();
    throw new CatalogUnavailableError(result.error.kind);
  }

  const product = result.data;
  const [t, tc, related] = await Promise.all([
    getTranslations("Product"),
    getTranslations("Common"),
    product.category ? getProducts(locale, market.code, { categoryId: product.category.id, perPage: 9 }) : null,
  ]);

  const purchasable = toPurchasable(product);
  const price = priceViewFromDetail(product);
  const trail = product.category?.path ?? [];
  const url = localizedUrl(seoConfig.siteUrl, locale, `/products/${product.slug}`);
  const singleSku = product.variants.length === 1 ? product.variants[0].sku : null;
  const relatedItems = related?.ok ? related.data.items.filter((p) => p.id !== product.id).slice(0, 8) : [];

  const attributes = product.attributes.flatMap((a) => {
    if (!a.attribute) return [];
    const v = a.value;
    const text =
      v === null ? null : typeof v === "object" ? (v.name ?? v.display_value ?? null) : typeof v === "boolean" ? t(v ? "yes" : "no") : String(v);
    return text ? [{ id: a.attribute.id, name: a.attribute.name, value: text }] : [];
  });

  return (
    <>
      <JsonLd
        data={[
          ...(price
            ? [
                productJsonLd({
                  url,
                  name: product.name,
                  description: product.description ? truncateDescription(product.description, 500) : null,
                  images: purchasable.gallery.flatMap((g) => (g.large ? [g.large] : [])),
                  sku: singleSku,
                  brandName: product.brand?.name,
                  sellerName: product.store?.name,
                  currency: product.currency.code,
                  lowPrice: price.amount,
                  highPrice: price.maxAmount,
                  inStock: product.is_in_stock,
                }),
              ]
            : []),
          breadcrumbJsonLd([
            { name: tc("home"), url: localizedUrl(seoConfig.siteUrl, locale, "/") },
            ...trail.map((c) => ({ name: c.name, url: localizedUrl(seoConfig.siteUrl, locale, `/categories/${c.slug}`) })),
            { name: product.name, url },
          ]),
        ]}
      />

      <Container className="pt-5 sm:pt-7">
        <Breadcrumbs
          items={[{ name: tc("home"), href: "/" }, ...trail.map((c) => ({ name: c.name, href: `/categories/${c.slug}` })), { name: product.name }]}
        />
      </Container>

      <ProductSelectionProvider product={purchasable}>
        <Container className="grid gap-8 pt-5 pb-6 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
          <section aria-label={t("details")} className="min-w-0 lg:sticky lg:top-[calc(var(--header-height)+1.25rem)] lg:self-start">
            <SelectedGallery />
          </section>

          <div className="min-w-0">
            {product.brand ? (
              <Link href={`/brands/${product.brand.slug}`} className="inline-flex min-h-10 items-center text-sm font-bold text-brand-text hover:underline">
                {product.brand.name}
              </Link>
            ) : null}
            <h1 className="tracking-display text-[1.75rem] leading-[1.15] font-extrabold text-balance sm:text-[2.25rem] xl:text-[2.5rem]">{product.name}</h1>
            {product.store ? (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Store className="size-4" aria-hidden />
                {t("soldBy", { store: product.store.name })}
              </p>
            ) : null}

            <div className="mt-7">
              <PurchasePanel />
            </div>

            {product.store ? (
              <section aria-labelledby="product-store" className="mt-8 flex gap-4 rounded-card border border-border bg-surface p-5">
                <span className="block size-16 shrink-0 overflow-hidden rounded-well bg-on-media ring-1 ring-border">
                  <AppImage src={product.store.logo} alt="" ratio="1/1" fit="contain" sizes="64px" />
                </span>
                <div className="min-w-0">
                  <h2 id="product-store" className="text-xs font-semibold text-muted-foreground">
                    {t("soldByHeading")}
                  </h2>
                  <p className="mt-0.5 text-base font-bold">{product.store.name}</p>
                  {product.store.description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{product.store.description}</p> : null}
                </div>
              </section>
            ) : null}
          </div>
        </Container>
      </ProductSelectionProvider>

      {product.description || attributes.length ? (
        <Container className="grid gap-6 py-8 lg:grid-cols-2 lg:gap-10">
          {product.description ? (
            <section aria-labelledby="product-description" className="rounded-panel bg-surface p-6 shadow-card ring-1 ring-border/70 sm:p-8">
              <h2 id="product-description" className="tracking-display text-xl font-extrabold sm:text-2xl">
                {t("description")}
              </h2>
              <p className="mt-4 max-w-prose text-base leading-loose whitespace-pre-line text-muted-foreground">{product.description}</p>
            </section>
          ) : null}
          {attributes.length ? (
            <section aria-labelledby="product-specs" className="rounded-panel bg-surface p-6 shadow-card ring-1 ring-border/70 sm:p-8">
              <h2 id="product-specs" className="tracking-display text-xl font-extrabold sm:text-2xl">
                {t("specifications")}
              </h2>
              <dl className="mt-4 divide-y divide-border">
                {attributes.map((a) => (
                  <div key={a.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 py-3.5 text-sm sm:text-base">
                    <dt className="text-muted-foreground">{a.name}</dt>
                    <dd className="font-semibold">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </Container>
      ) : null}

      {relatedItems.length ? (
        <Container as="section" aria-labelledby="related" className="py-8">
          <h2 id="related" className="tracking-display mb-6 text-[1.5rem] font-extrabold sm:text-[2rem]">
            {t("related")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {relatedItems.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} sizes="(min-width: 1024px) 24vw, (min-width: 640px) 31vw, 48vw" />
              </li>
            ))}
          </ul>
        </Container>
      ) : null}

      {/* Room for the mobile sticky purchase bar so it never covers content. */}
      <div className="h-24 lg:hidden" aria-hidden />
    </>
  );
}
