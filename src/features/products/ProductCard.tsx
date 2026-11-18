import { useLocale, useTranslations } from "next-intl";
import { AppImage } from "@/components/shared/AppImage";
import { Link } from "@/lib/i18n/navigation";
import { formatPercent } from "@/lib/i18n/format";
import { productCardImage } from "@/lib/images";
import type { ProductCard as ProductCardData } from "@/lib/api/schemas";
import { cn } from "@/lib/utils/cn";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { priceViewFromCard } from "./pricing";
import { ProductPrice } from "./ProductPrice";
import { QuickAddButton } from "./QuickAddButton";

interface ProductCardProps {
  product: ProductCardData;
  /** `sizes` hint for the image slot. */
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * The storefront's one product card: white card, photo-first, brand or category,
 * two-line title, seller, bold price and a red cart button. Everything is API
 * data: a discount only when the API reports a real reduction, and no rating row
 * because no ratings source exists. The whole card is one stretched link; the
 * heart and the cart button sit above it.
 *
 * On a filtered listing the API may add `matched_variant`: the cheapest variant
 * satisfying every variant-level filter. Then the card shows THAT variant's
 * price and stock (never a cheaper variant that did not match) and opens the
 * product page with it preselected (`?variant=<id>`, validated there).
 */
export function ProductCard({ product, sizes, priority, className }: ProductCardProps) {
  const locale = useLocale();
  const t = useTranslations("Product");
  const image = productCardImage(product, "card");
  const price = priceViewFromCard(product);
  const eyebrow = product.brand?.name || product.category?.name;
  const matched = product.matched_variant ?? null;
  const inStock = matched ? matched.is_in_stock : product.is_in_stock;
  const href = matched ? `/products/${product.slug}?variant=${matched.id}` : `/products/${product.slug}`;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col rounded-card bg-surface p-2 shadow-card ring-1 ring-border/70 transition-[box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-1 hover:shadow-raised lg:p-2.5",
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-well bg-image-well">
        <AppImage
          src={image?.src}
          alt={product.primary_image?.alt_text || product.name}
          ratio="1/1"
          sizes={sizes ?? "(min-width: 1280px) 18vw, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw"}
          priority={priority}
          fallbackLabel={t("imageMissing")}
          className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.045]"
        />
        {/* Sibling of the stretched title link (never nested in it), lifted above it. */}
        <WishlistButton
          product={{ id: product.id, slug: product.slug, name: product.name, imageUrl: image?.src ?? null }}
          className="absolute end-2 top-2 z-10 size-9 [&_svg]:size-4.5"
        />
        <div className="pointer-events-none absolute start-2 top-2 flex flex-col items-start gap-1.5">
          {price?.discountPercent ? (
            <span className="rounded-full bg-brand px-2.5 py-1.5 text-xs leading-none font-bold text-brand-foreground shadow-sm tabular-nums">
              {t("off", { percent: formatPercent(price.discountPercent, locale) })}
            </span>
          ) : null}
          {!inStock ? (
            <span className="rounded-full bg-on-media/95 px-2.5 py-1.5 text-xs leading-none font-semibold text-on-media-foreground shadow-sm">{t("outOfStock")}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-1 pt-3 pb-1 lg:px-1.5">
        {eyebrow ? <p className="mb-1 truncate text-xs font-medium text-muted-foreground">{eyebrow}</p> : null}
        <h3 className="line-clamp-2 min-h-[2.7em] text-sm leading-snug font-bold text-foreground lg:text-[0.9375rem]">
          <Link
            href={href}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-(--focus-ring)"
          >
            {product.name}
          </Link>
        </h3>
        {product.store?.name ? (
          <p className="mt-1.5 truncate text-xs text-muted-foreground">
            <span className="sr-only">{t("soldBy", { store: product.store.name })}</span>
            <span aria-hidden>{product.store.name}</span>
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <ProductPrice price={price} size="md" />
            {price?.matched ? (
              <p className="mt-1.5 text-xs text-muted-foreground" data-testid="matched-price-note">
                {t("matchedOption")}
              </p>
            ) : null}
          </div>
          {inStock && price ? (
            <QuickAddButton product={{ id: product.id, slug: product.slug, name: product.name, imageUrl: image?.src ?? null, currency: product.currency }} href={href} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
