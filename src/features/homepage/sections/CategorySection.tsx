import { AppImage } from "@/components/shared/AppImage";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Link } from "@/lib/i18n/navigation";
import type { CategoryCard } from "@/lib/api/schemas";
import { cn } from "@/lib/utils/cn";
import type { HomepageSection } from "../model";

type CategorySectionData = Extract<HomepageSection, { kind: "category" }>;

/**
 * Department tile (approved homepage.png "تسوق حسب القسم"): white card, image
 * well on top, centered label beneath. Same proportions in every layout so a
 * row always reads as one set.
 */
function CategoryTile({ category, sizes, large }: { category: CategoryCard; sizes: string; large?: boolean }) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col rounded-card bg-background p-2 ring-1 ring-border/70 transition-[box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-1 hover:shadow-raised lg:p-2.5"
    >
      <span className="block overflow-hidden rounded-well bg-image-well">
        <AppImage
          src={category.image_url}
          alt=""
          ratio={large ? "4/3" : "1/1"}
          sizes={sizes}
          className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.05]"
        />
      </span>
      <span
        className={cn(
          "flex flex-1 items-center justify-center px-1 text-center leading-snug font-semibold text-balance text-foreground group-hover:text-brand-text",
          large ? "min-h-12 pt-3 pb-1.5 text-base lg:text-lg" : "min-h-11 pt-2.5 pb-1 text-sm sm:text-[0.9375rem] lg:text-base",
        )}
      >
        {category.name}
      </span>
    </Link>
  );
}

export function CategorySection({
  section,
  headingId,
  title,
}: {
  section: CategorySectionData;
  headingId: string;
  title: string;
}) {
  if (section.layout === "carousel") {
    return (
      <Carousel
        headingId={headingId}
        title={title}
        subtitle={section.subtitle}
        itemClassName="w-[31%] sm:w-[23%] lg:w-[calc((100%-6.25rem)/6)]"
      >
        {section.items.map((category) => (
          <CategoryTile key={category.id} category={category} sizes="(min-width: 1024px) 14vw, 30vw" />
        ))}
      </Carousel>
    );
  }

  const large = section.layout === "grid";
  return (
    <>
      <SectionHeading id={headingId} title={title} subtitle={section.subtitle} />
      <ul
        className={cn(
          "grid gap-2.5 sm:gap-4 lg:gap-5",
          large ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6",
        )}
      >
        {section.items.map((category) => (
          <li key={category.id}>
            <CategoryTile
              category={category}
              large={large}
              sizes={large ? "(min-width: 1024px) 24vw, (min-width: 640px) 31vw, 48vw" : "(min-width: 1024px) 15vw, (min-width: 640px) 24vw, 32vw"}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
