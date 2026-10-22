import { AppImage } from "@/components/shared/AppImage";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Link } from "@/lib/i18n/navigation";
import type { BrandCard } from "@/lib/api/schemas";
import type { HomepageSection } from "../model";

type BrandSectionData = Extract<HomepageSection, { kind: "brand" }>;

/**
 * Brand tile: brand logos arrive as full-bleed square artworks with their own
 * background color, so they are shown edge-to-edge (never recolored or
 * padded into a postage stamp), with the name beneath. A light plate sits
 * behind for transparent logos and the missing-logo fallback.
 */
function BrandTile({ brand }: { brand: BrandCard }) {
  return (
    <Link
      href={`/brands/${brand.slug}`}
      className="group flex h-full flex-col rounded-card bg-surface p-2 shadow-card ring-1 ring-border/70 transition-[box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-1 hover:shadow-raised lg:p-2.5"
    >
      <span className="block overflow-hidden rounded-well bg-on-media ring-1 ring-black/5">
        <AppImage
          src={brand.logo_url}
          alt=""
          ratio="4/3"
          sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 19vw, (min-width: 640px) 24vw, 42vw"
          className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.06]"
        />
      </span>
      <span className="flex min-h-12 items-center justify-center truncate px-2 pt-1 text-center text-[0.9375rem] font-semibold text-foreground group-hover:text-brand-text lg:text-base">
        {brand.name}
      </span>
    </Link>
  );
}

export function BrandSection({ section, headingId, title }: { section: BrandSectionData; headingId: string; title: string }) {
  if (section.layout === "carousel") {
    return (
      <Carousel
        headingId={headingId}
        title={title}
        subtitle={section.subtitle}
        itemClassName="w-[42%] sm:w-[24%] lg:w-[calc((100%-5rem)/5)] xl:w-[calc((100%-6.25rem)/6)]"
      >
        {section.items.map((brand) => (
          <BrandTile key={brand.id} brand={brand} />
        ))}
      </Carousel>
    );
  }

  return (
    <>
      <SectionHeading id={headingId} title={title} subtitle={section.subtitle} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6">
        {section.items.map((brand) => (
          <li key={brand.id}>
            <BrandTile brand={brand} />
          </li>
        ))}
      </ul>
    </>
  );
}
