import { getTranslations } from "next-intl/server";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading, ViewAllLink } from "@/components/shared/SectionHeading";
import { BrandTile } from "@/features/catalog/BrandTile";
import type { HomepageSection } from "../model";

type BrandSectionData = Extract<HomepageSection, { kind: "brand" }>;

export async function BrandSection({ section, headingId, title }: { section: BrandSectionData; headingId: string; title: string }) {
  const tc = await getTranslations("Common");
  const action = <ViewAllLink href="/brands" label={tc("viewAll")} />;

  if (section.layout === "carousel") {
    return (
      <Carousel
        headingId={headingId}
        title={title}
        subtitle={section.subtitle}
        action={action}
        itemClassName="w-[42%] sm:w-[24%] lg:w-[calc((100%-5rem)/5)] xl:w-[calc((100%-6.25rem)/6)]"
      >
        {section.items.map((brand) => (
          <BrandTile key={brand.id} name={brand.name} slug={brand.slug} logo={brand.logo_url} />
        ))}
      </Carousel>
    );
  }

  return (
    <>
      <SectionHeading id={headingId} title={title} subtitle={section.subtitle} action={action} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
        {section.items.map((brand) => (
          <li key={brand.id}>
            <BrandTile name={brand.name} slug={brand.slug} logo={brand.logo_url} />
          </li>
        ))}
      </ul>
    </>
  );
}
