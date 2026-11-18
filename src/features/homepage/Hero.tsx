import { ArrowLeft } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Container } from "@/components/shared/Container";
import { buttonClass } from "@/components/ui/button";
import { priceViewFromCard } from "@/features/products/pricing";
import { currencyName, formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { HeroCarousel } from "./HeroCarousel";
import type { HeroContent, HeroDepartment, HeroFeature } from "./hero-content";

interface HeroProps {
  content: HeroContent;
  departments: HeroDepartment[];
  currencyCode: string | null;
}

const ARROW = "size-5 ltr:rotate-180";

/**
 * Opening band: a large image-led banner with headline and CTA, beside two
 * category banners. There is no banner endpoint, so slides and banners come from
 * what the Admin curated on the homepage (real photos, names, prices, links);
 * the copy is static UI text and makes no promotional claims.
 */
export async function Hero({ content, departments, currencyCode }: HeroProps) {
  const [t, locale] = await Promise.all([getTranslations("Hero"), getLocale()]);
  const { slides, promos } = content;
  const lead = currencyCode ? t("lead", { currency: currencyName(currencyCode, locale) }) : t("leadNoCurrency");

  return (
    <Container as="section" aria-labelledby="hero-title" className="pt-3 sm:pt-5 lg:pt-6">
      <div className={cn("grid gap-3 lg:gap-4", promos.length && "lg:grid-cols-[minmax(0,2.9fr)_minmax(0,1fr)]")}>
        {slides.length ? (
          <HeroCarousel className="max-lg:aspect-[5/4] sm:max-lg:aspect-[2/1] lg:h-[25rem] xl:h-[27rem]">
            {slides.map((slide, index) => (
              <Slide key={slide.product.id} slide={slide} first={index === 0} title={t("title")} lead={lead} cta={t("shopNow")} viewProduct={t("viewProduct")} eyebrow={t("eyebrow")} locale={locale} />
            ))}
          </HeroCarousel>
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
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:grid-rows-2 lg:gap-4">
            {promos.map((promo) => (
              <li key={promo.key} className="min-w-0">
                <Link
                  href={promo.href}
                  className="group relative isolate flex h-full min-h-[10rem] flex-col justify-end overflow-hidden rounded-panel bg-image-well p-4 sm:min-h-[12rem] lg:min-h-0 lg:p-5"
                >
                  <AppImage
                    src={promo.image.src}
                    alt=""
                    ratio="fill"
                    wrapperClassName="-z-10"
                    sizes="(min-width: 1024px) 24vw, 50vw"
                    className="-z-10 transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.04]"
                  />
                  <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim via-scrim/30 to-transparent" />
                  <span className="text-base leading-tight font-extrabold text-white sm:text-lg lg:text-xl">{promo.title}</span>
                  <span className="mt-1.5 inline-flex w-fit items-center gap-1.5 text-sm font-bold text-white">
                    {t("shopNow")}
                    <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
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

function Slide({
  slide,
  first,
  title,
  lead,
  cta,
  viewProduct,
  eyebrow,
  locale,
}: {
  slide: HeroFeature;
  first: boolean;
  title: string;
  lead: string;
  cta: string;
  viewProduct: string;
  eyebrow: string;
  locale: string;
}) {
  const price = priceViewFromCard(slide.product);
  const amount = price ? formatMoney(price.amount, price.currency, locale) : null;
  // Below 360px a smaller size keeps Alexandria's wider Latin to two lines, so the lead still fits the 5:4 card.
  const heading = "tracking-display mt-2 text-[1.5rem] min-[360px]:text-[1.75rem] leading-[1.15] font-extrabold text-balance text-white sm:text-[2.25rem] lg:mt-3 lg:text-[2.75rem] lg:text-foreground xl:text-[3.25rem] ltr:xl:text-[3rem]";

  return (
    <div className="relative isolate h-full overflow-hidden">
      <AppImage src={slide.image.src} alt="" ratio="fill" wrapperClassName="-z-10" priority={first} quality={85} sizes="(min-width: 1024px) 72vw, 100vw" className="-z-10" />
      {/* Desktop: a soft wash from the text side. Phones: a dark scrim from the bottom. */}
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-scrim via-scrim/45 to-transparent lg:from-hero-wash lg:via-hero-wash/90 lg:to-transparent lg:ltr:bg-linear-to-r lg:rtl:bg-linear-to-l lg:[--tw-gradient-via-position:46%] lg:[--tw-gradient-to-position:76%]"
      />
      <div className="flex h-full flex-col justify-end p-5 pb-8 sm:p-8 lg:max-w-[40rem] lg:justify-center lg:px-20 lg:py-10">
        <p className="flex items-center gap-2.5 text-sm font-bold text-white/90 lg:text-brand-text">
          <span className="hidden h-0.5 w-7 rounded-full bg-brand lg:block" aria-hidden />
          {slide.eyebrow ?? eyebrow}
        </p>
        {first ? (
          <h1 id="hero-title" className={heading}>
            {title}
          </h1>
        ) : (
          <p className={cn(heading, "line-clamp-2 lg:text-[2.25rem] xl:text-[2.5rem] ltr:xl:text-[2.5rem]")}>{slide.product.name}</p>
        )}
        {first ? (
          <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-pretty text-white/85 sm:text-base lg:mt-3 lg:text-lg lg:text-muted-foreground">{lead}</p>
        ) : amount ? (
          <p className="mt-2 text-xl font-extrabold text-white tabular-nums lg:mt-3 lg:text-2xl lg:text-brand-text">{amount}</p>
        ) : null}
        <div className="mt-4 lg:mt-6">
          <Link
            href={first ? "/products" : `/products/${slide.product.slug}`}
            className={buttonClass({ variant: "brand", size: "lg" }, "h-11 gap-2.5 px-6 lg:h-12 lg:px-8 lg:shadow-[0_12px_24px_-12px_var(--brand)]")}
          >
            {first ? cta : viewProduct}
            <ArrowLeft className={ARROW} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
