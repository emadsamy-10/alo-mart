import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";

export interface DepartmentLeadData {
  name: string;
  href: string;
  children: { name: string; href: string }[];
}

/**
 * Editorial lead card opening a product row that the Admin targeted at a
 * department: the department's name and its real sub-categories (from the
 * category tree) as quick links. Typographic on purpose — category images in
 * the catalog are cut-outs that don't hold a tall card. Only real links.
 */
export async function DepartmentLead({ lead, headingId }: { lead: DepartmentLeadData; headingId: string }) {
  const t = await getTranslations("Sections");
  return (
    <div
      role="group"
      aria-labelledby={`${headingId}-lead`}
      className="panel-ink flex h-full flex-col rounded-card bg-panel p-4 text-panel-foreground sm:p-5 lg:p-6"
    >
      <p className="text-sm font-semibold text-panel-muted">{t("leadEyebrow")}</p>
      <p id={`${headingId}-lead`} className="tracking-display mt-1.5 text-xl leading-tight font-extrabold text-balance sm:text-2xl lg:text-[1.75rem]">
        {lead.name}
      </p>
      {lead.children.length ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {lead.children.slice(0, 5).map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                className="inline-flex min-h-10 items-center rounded-full bg-panel-raised px-3.5 text-sm font-medium text-panel-foreground ring-1 ring-white/10 transition-colors hover:bg-on-media hover:text-on-media-foreground"
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={lead.href}
        className="mt-auto flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm leading-snug font-bold text-brand-foreground transition-colors hover:bg-brand-ink max-lg:mt-6 sm:text-[0.9375rem]"
      >
        {t("leadCta", { name: lead.name })}
        <ArrowRight className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
      </Link>
    </div>
  );
}
