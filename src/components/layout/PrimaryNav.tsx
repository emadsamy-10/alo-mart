"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { NavCategory } from "./nav-types";

/** Every slug in a department's subtree, so sub-category pages light up their department. */
function subtreeSlugs(node: NavCategory): string[] {
  return [node.slug, ...node.children.flatMap(subtreeSlugs)];
}

/**
 * How many departments fit in the capsule at each width (measured against
 * the longest real labels, English). The rest stay one click away in the
 * "All departments" mega menu — labels are never squeezed.
 */
const VISIBILITY = [
  "", // 1st–2nd: always (≥1024px, where the desktop header starts)
  "",
  "hidden xl:block", // 3rd–4th: ≥1280px
  "hidden xl:block",
  "hidden min-[90rem]:block", // 5th: ≥1440px (content width is capped at 1344px)
];

const ITEM =
  "inline-flex h-10 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-(--duration-base) ease-out-soft";
const ACTIVE = "bg-ink text-ink-foreground shadow-[0_6px_16px_-8px_rgb(20_32_47/0.6)]";
const IDLE = "text-foreground/80 hover:bg-surface-muted hover:text-foreground";

/**
 * Floating navigation capsule: Home + primary departments. Links are
 * server-rendered (crawlable); the client part reads the path to mark the
 * active item — Home on the homepage, the matching department on any of its
 * category pages, nothing elsewhere.
 */
export function PrimaryNav({ departments, className }: { departments: NavCategory[]; className?: string }) {
  const t = useTranslations("Header");
  const tc = useTranslations("Common");
  const pathname = usePathname();
  const currentSlug = pathname.match(/^\/categories\/([^/?#]+)/)?.[1] ?? null;
  const homeActive = pathname === "/";

  return (
    <nav aria-label={t("mainNavigation")} className={className}>
      <ul className="flex items-center gap-1 rounded-full bg-surface p-1 shadow-card ring-1 ring-border/80">
        <li>
          <Link href="/" aria-current={homeActive ? "page" : undefined} className={cn(ITEM, homeActive ? ACTIVE : IDLE)}>
            {tc("home")}
          </Link>
        </li>
        {departments.slice(0, VISIBILITY.length).map((department, index) => {
          const active = currentSlug !== null && subtreeSlugs(department).includes(currentSlug);
          return (
            <li key={department.slug} className={VISIBILITY[index]}>
              <Link
                href={`/categories/${department.slug}`}
                aria-current={active ? "page" : undefined}
                className={cn(ITEM, active ? ACTIVE : IDLE)}
              >
                {department.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
