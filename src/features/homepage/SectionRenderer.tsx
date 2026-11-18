import { Percent } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { cn } from "@/lib/utils/cn";
import type { HomepageSection } from "./model";
import { BrandSection } from "./sections/BrandSection";
import { CategorySection } from "./sections/CategorySection";
import { ProductSection } from "./sections/ProductSection";

/** Anchor target of the first category section. */
export const DEPARTMENTS_ANCHOR = "departments";

/**
 * Renders Admin-configured sections in server order on the warm page
 * background. Each section TYPE picks its composition (deals get the navy
 * band; categories and brands get tiles); each section's LAYOUT hint picks
 * carousel vs grid within it. Adding a new type = one entry in model.ts
 * SECTION_TYPES + a case here.
 */
export async function SectionRenderer({ sections }: { sections: HomepageSection[] }) {
  const t = await getTranslations("Sections");
  const firstCategorySection = sections.find((s) => s.kind === "category")?.id;

  return (
    <>
      {sections.map((section) => {
        const headingId = `section-${section.id}`;
        const title =
          section.title ??
          (section.kind === "category" ? t("untitledCategories") : section.kind === "brand" ? t("untitledBrands") : t("untitledProducts"));
        const isDeals = section.type === "deals";

        return (
          <section
            key={section.id}
            id={section.id === firstCategorySection ? DEPARTMENTS_ANCHOR : undefined}
            aria-labelledby={headingId}
            data-section-type={section.type}
            className={cn("py-5 sm:py-6 lg:py-8", isDeals && "py-6 lg:py-10")}
          >
            <Container>
              {section.kind === "product" ? (
                isDeals ? (
                  <div className="panel-ink relative isolate overflow-hidden rounded-panel bg-panel px-3 pt-6 pb-2 sm:px-6 sm:pt-8 lg:px-9 lg:pt-10 lg:pb-5">
                    <span aria-hidden className="absolute -end-24 -top-32 -z-10 size-96 rounded-full bg-brand/25 blur-3xl" />
                    <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-xs font-bold text-brand-foreground">
                      <Percent className="size-3.5" strokeWidth={2.5} aria-hidden />
                      {t("dealsEyebrow")}
                    </p>
                    <ProductSection section={section} headingId={headingId} title={title} tone="panel" />
                  </div>
                ) : (
                  <ProductSection section={section} headingId={headingId} title={title} />
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
