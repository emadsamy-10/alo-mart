import { getTranslations } from "next-intl/server";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading, ViewAllLink } from "@/components/shared/SectionHeading";
import { ProductCard } from "@/features/products/ProductCard";
import type { HomepageSection } from "../model";
import { DepartmentLead, type DepartmentLeadData } from "./DepartmentLead";

type ProductSectionData = Extract<HomepageSection, { kind: "product" }>;

/**
 * Five generous cards per row on desktop (≈253px at 1440) — the mockup's six
 * were too small for real product photography; four on small laptops; a
 * peeking 2-up row on phones. Gaps: 12px → 16px → 20px (lg).
 */
const ROW_ITEM = "w-[46%] sm:w-[31%] lg:w-[calc((100%-3.75rem)/4)] xl:w-[calc((100%-5rem)/5)]";
const ROW_SIZES = "(min-width: 1280px) 19vw, (min-width: 1024px) 24vw, (min-width: 640px) 31vw, 46vw";
const GRID_SIZES = "(min-width: 1024px) 24vw, (min-width: 640px) 31vw, 48vw";

/** "View all" only when the section points at a real listing (category/brand). */
async function targetLink(section: ProductSectionData, title: string, tone: "default" | "panel") {
  if (!section.target) return null;
  const [t, tc] = await Promise.all([getTranslations("Sections"), getTranslations("Common")]);
  const isCategory = section.target.kind === "category";
  return (
    <ViewAllLink
      href={isCategory ? `/categories/${section.target.slug}` : `/brands/${section.target.slug}`}
      label={tc("viewAll")}
      accessibleLabel={isCategory ? t("viewCategory", { name: title }) : t("viewBrand", { name: title })}
      tone={tone}
    />
  );
}

export async function ProductSection({
  section,
  headingId,
  title,
  tone = "default",
  lead,
}: {
  section: ProductSectionData;
  headingId: string;
  title: string;
  tone?: "default" | "panel";
  /** Department card opening a category-targeted row (carousel layout only). */
  lead?: DepartmentLeadData | null;
}) {
  const action = await targetLink(section, title, tone);
  // New Arrivals reads as a lighter, quicker strip (compact cards) for rhythm.
  const variant = section.type === "new_arrivals" ? "compact" : "standard";

  if (section.layout === "grid") {
    return (
      <>
        <SectionHeading id={headingId} title={title} subtitle={section.subtitle} action={action} tone={tone} />
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
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
      {lead ? <DepartmentLead key="lead" lead={lead} headingId={headingId} /> : null}
      {section.items.map((product) => (
        <ProductCard key={product.id} product={product} sizes={ROW_SIZES} variant={variant} />
      ))}
    </Carousel>
  );
}
