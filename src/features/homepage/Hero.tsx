import { ArrowRight, ChevronRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Container } from "@/components/shared/Container";
import { buttonClass } from "@/components/ui/button";
import { priceViewFromCard } from "@/features/products/pricing";
import { currencyName, formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { HeroContent, HeroDepartment } from "./hero-content";

interface HeroProps {
  content: HeroContent;
  departments: HeroDepartment[];
  currencyCode: string | null;
  /** In-page anchor (#departments) or a category URL. */
  browseHref: string | null;
}

/**
 * Image-led opening band (approved homepage.png): a wide photo banner with the
 * headline on the inline-start side, beside two stacked department promos.
 * All imagery and links are real (see hero.ts); the copy is static UI text and
 * makes no promotional claims.
 */
export async function Hero({ content, departments, currencyCode, browseHref }: HeroProps) {
  const [t, locale] = await Promise.all([getTranslations("Hero"), getLocale()]);
  const { feature, promos } = content;
  const lead = currencyCode ? t("lead", { currency: currencyName(currencyCode, locale) }) : t("leadNoCurrency");

  return (
    <Container as="section" aria-labelledby="hero-title" className="pt-4 sm:pt-6 lg:pt-7">
      <div className={cn("grid gap-3 lg:gap-5", promos.length && "lg:grid-cols-[minmax(0,2.75fr)_minmax(0,1fr)]")}>
        {feature ? (
          <div className="relative isolate overflow-hidden rounded-panel bg-image-well max-lg:aspect-[4/5] sm:max-lg:aspect-[16/10] lg:h-[31rem] xl:h-[33rem]">
            <AppImage
              src={feature.image.src}
              alt=""
              ratio="fill"
              wrapperClassName="-z-10"
              priority
              quality={85}
              sizes="(min-width: 1024px) 70vw, 100vw"
              className="-z-10"
            />
            {/* Desktop: ivory wash from the text side. Mobile: dark scrim from the bottom. */}
            <span
              aria-hidden
              className="absolute inset-0 -z-10 bg-linear-to-t from-scrim via-scrim/40 to-transparent lg:from-background lg:via-background/85 lg:to-transparent lg:ltr:bg-linear-to-r lg:rtl:bg-linear-to-l lg:[--tw-gradient-via-position:42%] lg:[--tw-gradient-to-position:74%]"
            />

            <div className="flex h-full flex-col justify-end p-5 sm:p-8 lg:max-w-[44rem] lg:justify-center lg:p-14">
              <p className="flex items-center gap-2.5 text-sm font-bold text-white/90 sm:text-base lg:text-brand-text">
                <span className="hidden h-0.5 w-8 rounded-full bg-brand lg:block" aria-hidden />
                {feature.eyebrow ?? t("eyebrow")}
              </p>
              <h1
                id="hero-title"
                className="tracking-display mt-3 text-[2.125rem] leading-[1.1] font-extrabold text-balance text-white sm:text-[2.75rem] lg:text-[3.25rem] lg:text-foreground xl:text-[3.75rem] ltr:xl:text-[3.4rem]"
              >
                {t("title")}
              </h1>
              <p className="mt-3 max-w-md text-base leading-relaxed text-pretty text-white/85 lg:mt-5 lg:max-w-lg lg:text-lg lg:text-muted-foreground">{lead}</p>
              {browseHref ? (
                <div className="mt-6 lg:mt-9">
                  <Link
                    href={browseHref}
                    className={buttonClass(
                      { variant: "primary", size: "lg" },
                      "h-12 gap-3 px-7 text-base lg:h-14 lg:px-9 lg:text-[1.0625rem] lg:shadow-raised max-lg:bg-on-media max-lg:text-on-media-foreground max-lg:hover:bg-on-media/90",
                    )}
                  >
                    {t("browse")}
                    <ArrowRight className="size-5 rtl:-scale-x-100" aria-hidden />
                  </Link>
                </div>
              ) : null}
            </div>

            <ProductTag content={content} locale={locale} label={t("viewProduct")} />
          </div>
        ) : (
          <div className="rounded-panel bg-surface p-8 shadow-card lg:p-12">
            <h1 id="hero-title" className="tracking-display max-w-xl text-4xl leading-tight font-extrabold text-balance lg:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 max-w-md text-muted-foreground">{lead}</p>
            <ul className="mt-7 flex flex-wrap gap-2">
              {departments.map((d) => (
                <li key={d.slug}>
                  <Link href={`/categories/${d.slug}`} className={buttonClass({ variant: "outline", size: "md" }, "h-11")}>
                    {d.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {promos.length ? (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:grid-rows-2 lg:gap-5">
            {promos.map((promo) => (
              <li key={promo.key} className="min-w-0">
                <Link
                  href={promo.href}
                  className="group relative isolate flex h-full min-h-[11rem] flex-col justify-end overflow-hidden rounded-panel bg-image-well p-4 sm:min-h-[13rem] lg:min-h-0 lg:p-6"
                >
                  <AppImage
                    src={promo.image.src}
                    alt=""
                    ratio="fill"
              wrapperClassName="-z-10"
                    sizes="(min-width: 1024px) 26vw, 50vw"
                    className="-z-10 transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.04]"
                  />
                  <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim via-scrim/35 to-transparent" />
                  <span className="text-lg leading-tight font-extrabold text-white sm:text-xl lg:text-2xl">{promo.title}</span>
                  <span className="mt-3 inline-flex h-10 w-fit items-center gap-1.5 rounded-full bg-on-media px-5 text-sm font-semibold text-on-media-foreground shadow-sm transition-transform group-hover:-translate-y-0.5">
                    {t("shopNow")}
                    <ArrowRight className="size-3.5 rtl:-scale-x-100" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Container>
  );
}

/** Shoppable tag: the real name and price of the pictured product, linking to it. */
function ProductTag({ content, locale, label }: { content: HeroContent; locale: string; label: string }) {
  const product = content.feature?.product;
  if (!product) return null;
  const price = priceViewFromCard(product);
  const amount = price ? formatMoney(price.amount, price.currency, locale) : null;

  return (
    <Link
      href={`/products/${product.slug}`}
      aria-label={`${label}: ${product.name}`}
      className="absolute end-4 top-4 flex max-w-[16rem] items-center gap-3 rounded-2xl bg-on-media/95 py-3 ps-4 pe-3 text-on-media-foreground shadow-raised backdrop-blur transition-transform hover:-translate-y-0.5 lg:end-7 lg:top-auto lg:bottom-7 lg:max-w-[21rem] lg:ps-5"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold lg:text-[0.9375rem]">{product.name}</span>
        {amount ? <span className="mt-1 block text-base font-extrabold text-on-media-accent tabular-nums lg:text-lg">{amount}</span> : null}
      </span>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-on-media-foreground text-on-media lg:size-10">
        <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
      </span>
    </Link>
  );
}
