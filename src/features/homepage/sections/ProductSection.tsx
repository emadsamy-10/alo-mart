import { getTranslations } from "next-intl/server";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading, ViewAllLink } from "@/components/shared/SectionHeading";
import { ProductCard } from "@/features/products/ProductCard";
import type { HomepageSection, SectionType } from "../model";

type ProductSectionData = Extract<HomepageSection, { kind: "product" }>;

/**
 * Five cards per row on desktop (≈253px at 1440), four on small laptops, a
 * peeking 2-up row on phones. Gaps: 12px → 16px → 20px (lg).
 */
const ROW_ITEM = "w-[46%] sm:w-[31%] lg:w-[calc((100%-3.75rem)/4)] xl:w-[calc((100%-5rem)/5)]";
const ROW_SIZES = "(min-width: 1280px) 19vw, (min-width: 1024px) 24vw, (min-width: 640px) 31vw, 46vw";
const GRID_SIZES = "(min-width: 1024px) 24vw, (min-width: 640px) 31vw, 48vw";

/** Real catalog states behind the sections that have no category or brand target. */
const SECTION_LISTING: Partial<Record<SectionType, string>> = {
  best_sellers: "/products?sort=best_selling",
  new_arrivals: "/products?sort=newest",
  deals: "/products?on_sale=1",
  featured_products: "/products",
};

/** "View more" whenever the section has a real listing behind it. */
async function targetLink(section: ProductSectionData, title: string, tone: "default" | "panel") {
  const [t, tc] = await Promise.all([getTranslations("Sections"), getTranslations("Common")]);
  const target = section.target;
  const href = target ? (target.kind === "category" ? `/categories/${target.slug}` : `/brands/${target.slug}`) : SECTION_LISTING[section.type];
  if (!href) return null;
  const accessibleLabel = target?.kind === "brand" ? t("viewBrand", { name: title }) : t("viewCategory", { name: title });
  return <ViewAllLink href={href} label={tc("viewAll")} accessibleLabel={accessibleLabel} tone={tone} />;
}

export async function ProductSection({
  section,
  headingId,
  title,
  tone = "default",
}: {
  section: ProductSectionData;
  headingId: string;
  title: string;
  tone?: "default" | "panel";
}) {
  const action = await targetLink(section, title, tone);

  if (section.layout === "grid") {
    return (
      <>
        <SectionHeading id={headingId} title={title} subtitle={section.subtitle} action={action} tone={tone} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5">
          {section.items.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} sizes={GRID_SIZES} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <Carousel headingId={headingId} title={title} subtitle={section.subtitle} action={action} tone={tone} itemClassName={ROW_ITEM}>
      {section.items.map((product) => (
        <ProductCard key={product.id} product={product} sizes={ROW_SIZES} />
      ))}
    </Carousel>
  );
}
