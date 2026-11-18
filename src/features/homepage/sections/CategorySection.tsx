import { getTranslations } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Carousel } from "@/components/shared/Carousel";
import { SectionHeading, ViewAllLink } from "@/components/shared/SectionHeading";
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
      className="group flex h-full flex-col overflow-hidden rounded-card bg-surface-muted ring-1 ring-border/60 transition-[box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-1 hover:shadow-raised"
    >
      <span className="block overflow-hidden bg-image-well">
        <AppImage
          src={category.image_url}
          alt=""
          ratio="4/3"
          sizes={sizes}
          className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.05]"
        />
      </span>
      <span
        className={cn(
          "flex flex-1 items-center justify-center text-center leading-snug font-extrabold text-balance text-foreground group-hover:text-brand-text",
          large ? "min-h-12 px-2 py-2.5 text-base" : "min-h-11 px-1.5 py-2 text-[0.8125rem] sm:text-sm lg:text-[0.9375rem]",
        )}
      >
        {category.name}
      </span>
    </Link>
  );
}

export async function CategorySection({
  section,
  headingId,
  title,
}: {
  section: CategorySectionData;
  headingId: string;
  title: string;
}) {
  const t = await getTranslations("Sections");
  const action = <ViewAllLink href="/products" label={t("viewAllCategories")} />;

  if (section.layout === "carousel") {
    return (
      <Carousel
        headingId={headingId}
        title={title}
        subtitle={section.subtitle}
        action={action}
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
      <SectionHeading id={headingId} title={title} subtitle={section.subtitle} action={action} />
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
