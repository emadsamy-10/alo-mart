import { getTranslations } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { cn } from "@/lib/utils/cn";
import type { NavCategory } from "@/components/layout/nav-types";
import type { HomepageSection } from "./model";
import type { DepartmentLeadData } from "./sections/DepartmentLead";
import { BrandSection } from "./sections/BrandSection";
import { CategorySection } from "./sections/CategorySection";
import { ProductSection } from "./sections/ProductSection";

/**
 * Background rhythm by section role, so the page reads as distinct chapters
 * rather than repeated grids: department tiles sit on a white band, the
 * Admin's "grid" collections on a soft sand band with large cards, deals in a
 * navy panel; product rows and brands stay on the ivory page.
 */
function backgroundFor(section: HomepageSection): "page" | "white" | "sand" {
  if (section.kind === "category") return "white";
  if (section.kind === "product" && section.layout === "grid" && section.type !== "deals") return "sand";
  return "page";
}

/** Anchor target for the hero's "Browse departments" link. */
export const DEPARTMENTS_ANCHOR = "departments";

/** Department card data for a category-targeted section, from the real category tree. */
function leadFor(section: HomepageSection, departments: NavCategory[]): DepartmentLeadData | null {
  if (section.kind !== "product" || section.layout !== "carousel" || section.target?.kind !== "category") return null;
  const slug = section.target.slug;
  const find = (nodes: NavCategory[]): NavCategory | null => {
    for (const node of nodes) {
      if (node.slug === slug) return node;
      const hit = find(node.children);
      if (hit) return hit;
    }
    return null;
  };
  const node = find(departments);
  if (!node) return null;
  return {
    name: node.name,
    href: `/categories/${node.slug}`,
    children: node.children.map((c) => ({ name: c.name, href: `/categories/${c.slug}` })),
  };
}

/**
 * Renders Admin-configured sections in server order. Each section TYPE picks
 * its composition (deals get the navy band; categories and brands get tiles;
 * new arrivals get compact cards; category-targeted rows open with a
 * department card); each section's LAYOUT hint picks carousel vs grid within
 * it. Adding a new type = one entry in model.ts SECTION_TYPES + a case here.
 */
export async function SectionRenderer({ sections, departments = [] }: { sections: HomepageSection[]; departments?: NavCategory[] }) {
  const t = await getTranslations("Sections");
  const firstCategorySection = sections.find((s) => s.kind === "category")?.id;

  return (
    <>
      {sections.map((section) => {
        const headingId = `section-${section.id}`;
        const title =
          section.title ??
          (section.kind === "category"
            ? t("untitledCategories")
            : section.kind === "brand"
              ? t("untitledBrands")
              : t("untitledProducts"));
        const isDeals = section.type === "deals";
        const surface = backgroundFor(section);

        return (
          <section
            key={section.id}
            id={section.id === firstCategorySection ? DEPARTMENTS_ANCHOR : undefined}
            aria-labelledby={headingId}
            data-section-type={section.type}
            className={cn(
              "py-7 sm:py-9 lg:py-11",
              surface === "white" && "my-3 border-y border-border/60 bg-surface lg:my-5 lg:py-14",
              surface === "sand" && "my-3 bg-sand/45 lg:my-5 lg:py-14 dark:bg-surface-muted/60",
              isDeals && "py-4 sm:py-6 lg:py-8",
            )}
          >
            <Container>
              {section.kind === "product" ? (
                isDeals ? (
                  <div className="panel-ink rounded-panel bg-panel px-3 pt-7 pb-3 sm:px-8 sm:pt-10 sm:pb-6 lg:px-11 lg:pt-12 lg:pb-8">
                    <ProductSection section={section} headingId={headingId} title={title} tone="panel" />
                  </div>
                ) : (
                  <ProductSection section={section} headingId={headingId} title={title} lead={leadFor(section, departments)} />
                )
              ) : section.kind === "category" ? (
                <CategorySection section={section} headingId={headingId} title={title} />
              ) : (
                <BrandSection section={section} headingId={headingId} title={title} />
              )}
            </Container>
          </section>
        );
      })}
    </>
  );
}
