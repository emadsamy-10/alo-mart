"use client";

import { ArrowLeft, ChevronDown, LayoutGrid, Percent, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { categoryIcon } from "./category-icon";
import { activeNavKey, NAV_LINKS, type NavKey } from "./nav-links";
import type { NavCategory } from "./nav-types";

/** Links dropped as width runs out (never "All Products"); the mega menu and drawer still reach them. */
const VISIBILITY: Partial<Record<NavKey, string>> = {
  stores: "max-xl:group-data-stuck/header:hidden",
  brands: "max-xl:group-data-stuck/header:hidden",
  newArrivals: "max-xl:group-data-stuck/header:hidden",
};

/**
 * Same box for every entry, trigger included. Focus rings are inset so they stay
 * inside the row, and appear for keyboard users only.
 */
const NAV_ITEM =
  "relative inline-flex h-14 items-center gap-2 px-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-(--duration-fast) focus-visible:rounded-lg focus-visible:outline-offset-[-6px] xl:px-3 xl:text-[0.9375rem]";

function NavLinks({ params }: { params: { sort: string | null; onSale: string | null } | null }) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const active = activeNavKey(pathname, params);

  return (
    <ul className="flex min-w-0 items-center gap-1 lg:gap-0.5 xl:gap-2">
      {NAV_LINKS.map(({ key, href }) => {
        const current = active === key;
        return (
          <li key={key} className={VISIBILITY[key]}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={cn(
                NAV_ITEM,
                current
                  ? "font-bold text-foreground after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand xl:after:inset-x-3"
                  : "text-foreground/75 hover:text-foreground",
              )}
            >
              {t(key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The query only lights up the active link, so it hydrates behind Suspense. */
function NavLinksWithQuery() {
  const search = useSearchParams();
  return <NavLinks params={{ sort: search.get("sort"), onSale: search.get("on_sale") }} />;
}

/**
 * The pinned navigation row. The mega menu opens under the whole row (the
 * Container is the popover's anchor) and closes on Escape, an outside click or
 * any link; keyboard users Tab from the trigger straight into its links.
 * `compactStart` and `compactEnd` only appear once the row is pinned.
 */
export function MainNav({
  departments,
  compactStart,
  compactEnd,
  containerClassName,
}: {
  departments: NavCategory[];
  compactStart: ReactNode;
  compactEnd: ReactNode;
  containerClassName: string;
}) {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const navigating = useRef(false);
  const close = () => {
    navigating.current = true;
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <nav aria-label={t("mainNavigation")} className={cn("flex h-14 items-center gap-1.5 xl:gap-3", containerClassName)}>
          <div className="hidden shrink-0 group-data-stuck/header:block">{compactStart}</div>
          {departments.length ? (
            <>
              <Popover.Trigger
                data-testid="mega-menu-trigger"
                className={cn(NAV_ITEM, "group -ms-2.5 shrink-0 text-foreground hover:text-brand-text data-[state=open]:text-brand-text xl:-ms-3")}
              >
                <LayoutGrid className="size-4.5 shrink-0" strokeWidth={1.75} aria-hidden />
                {t("allDepartments")}
                <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform duration-(--duration-base) group-data-[state=open]:rotate-180" aria-hidden />
              </Popover.Trigger>
              <span className="h-5 w-px shrink-0 bg-border-strong" aria-hidden />
            </>
          ) : null}
          <Suspense fallback={<NavLinks params={null} />}>
            <NavLinksWithQuery />
          </Suspense>
          <div className="ms-auto hidden shrink-0 items-center gap-1 group-data-stuck/header:flex">{compactEnd}</div>
        </nav>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={6}
          collisionPadding={16}
          data-testid="mega-menu"
          // Escape and outside clicks return focus to the trigger; following a link does not.
          onCloseAutoFocus={(event) => {
            if (navigating.current) event.preventDefault();
            navigating.current = false;
          }}
          aria-label={t("allDepartments")}
          className="mega-menu z-50 max-h-(--radix-popover-content-available-height) w-[calc(var(--radix-popover-trigger-width)-4rem)] overflow-y-auto overscroll-contain rounded-panel border border-border bg-surface text-foreground shadow-popover"
        >
          <MegaMenuPanel departments={departments} onNavigate={close} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

const SUBCATEGORY_LIMIT = 5;

function MegaMenuPanel({ departments, onNavigate }: { departments: NavCategory[]; onNavigate: () => void }) {
  const t = useTranslations("Header");
  const withImage = departments.filter((d) => d.imageUrl);
  const [promoSlug, setPromoSlug] = useState(withImage[0]?.slug ?? null);
  const promo = withImage.find((d) => d.slug === promoSlug) ?? withImage[0] ?? null;

  return (
    <>
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_15rem]">
        <ul
          style={{ "--mega-columns": Math.min(departments.length, 6) } as CSSProperties}
          className="grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-x-5 gap-y-7 xl:grid-cols-[repeat(var(--mega-columns),minmax(0,1fr))] xl:gap-x-0 xl:divide-x xl:divide-border"
        >
          {departments.map((department) => {
            const Icon = categoryIcon(department.slug);
            const shown = department.children.slice(0, SUBCATEGORY_LIMIT);
            return (
              <li
                key={department.slug}
                className="min-w-0 xl:px-4 xl:first:ps-0 xl:last:pe-0"
                onMouseEnter={() => department.imageUrl && setPromoSlug(department.slug)}
                onFocus={() => department.imageUrl && setPromoSlug(department.slug)}
              >
                <Link
                  href={`/categories/${department.slug}`}
                  onClick={onNavigate}
                  className="flex min-h-10 items-center gap-2.5 text-[0.9375rem] leading-snug font-extrabold transition-colors hover:text-brand-text"
                >
                  <Icon className="size-5 shrink-0 text-brand-text" strokeWidth={1.75} aria-hidden />
                  {department.name}
                </Link>
                {shown.length ? (
                  <ul className="mt-1.5">
                    {shown.map((child) => (
                      <li key={child.slug}>
                        <Link
                          href={`/categories/${child.slug}`}
                          onClick={onNavigate}
                          className="flex min-h-9 items-center text-sm leading-snug text-muted-foreground transition-colors hover:text-brand-text"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {department.children.length > shown.length ? (
                  <Link href={`/categories/${department.slug}`} onClick={onNavigate} className="mt-1 flex min-h-9 items-center text-sm font-bold text-brand-text hover:underline">
                    {t("viewAll")}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>

        {promo ? (
          <Link
            href={`/categories/${promo.slug}`}
            onClick={onNavigate}
            className="group hidden flex-col self-start overflow-hidden rounded-card bg-surface-muted ring-1 ring-border/60 xl:flex"
          >
            <span className="block overflow-hidden bg-image-well">
              <AppImage
                src={promo.imageUrl}
                alt=""
                ratio="4/3"
                sizes="240px"
                className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.04]"
              />
            </span>
            <span className="flex flex-col items-start gap-2.5 p-3.5">
              <span className="text-[0.9375rem] leading-tight font-extrabold">{promo.name}</span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground">
                {t("shopNow")}
                <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden />
              </span>
            </span>
          </Link>
        ) : null}
      </div>

      <ul className="flex flex-wrap items-center gap-x-8 gap-y-1 border-t border-border bg-surface-muted/50 px-6 py-2">
        {[
          { href: "/products?on_sale=1", label: t("offers"), Icon: Percent },
          { href: "/brands", label: t("brands"), Icon: ShieldCheck },
          { href: "/products", label: t("allProducts"), Icon: LayoutGrid },
        ].map(({ href, label, Icon }) => (
          <li key={href}>
            <Link href={href} onClick={onNavigate} className="flex min-h-10 items-center gap-2 text-sm font-bold transition-colors hover:text-brand-text">
              <Icon className="size-4.5 text-brand-text" strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
