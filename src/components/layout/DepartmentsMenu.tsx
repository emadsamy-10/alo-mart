"use client";

import { ChevronDown, Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import type { NavCategory } from "./nav-types";

/**
 * Desktop mega menu over the real 3-level category tree.
 * Departments are a vertical tablist (arrow keys move, Tab enters the panel);
 * hovering a department previews it for pointer users. Every link targets a
 * real category page.
 */
export function DepartmentsMenu({ departments }: { departments: NavCategory[] }) {
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  if (departments.length === 0) return null;
  const current = departments[Math.min(active, departments.length - 1)];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = departments.length - 1;
    const next =
      event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  const close = () => setOpen(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          // Same 48px pill language as the navigation capsule.
          "group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-brand ps-4 pe-3.5 text-sm font-bold whitespace-nowrap text-brand-foreground shadow-[0_10px_24px_-12px_var(--brand)] transition-[background-color,box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-px hover:bg-brand-ink hover:shadow-[0_14px_28px_-12px_var(--brand)] data-[state=open]:bg-brand-ink data-[state=open]:ring-4 data-[state=open]:ring-brand/20",
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-white/15" aria-hidden>
          <Menu className="size-4" />
        </span>
        {t("allDepartments")}
        <ChevronDown className="size-4 opacity-80 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={12}
          collisionPadding={24}
          className="mega-menu z-50 w-[min(68rem,calc(100vw-3rem))] overflow-hidden rounded-[1.75rem] border border-border bg-surface text-foreground shadow-popover"
        >
          <div className="grid grid-cols-[15rem_1fr]">
            <div className="flex flex-col border-e border-border bg-surface-muted/60">
            <div
              role="tablist"
              aria-orientation="vertical"
              aria-label={t("departments")}
              className="flex flex-col gap-0.5 p-3"
            >
              {departments.map((department, index) => {
                const selected = index === active;
                return (
                  <button
                    key={department.slug}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${index}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onKeyDown={(e) => onTabKeyDown(e, index)}
                    onClick={() => setActive(index)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex h-11 items-center justify-between rounded-xl px-3.5 text-start text-sm transition-colors",
                      selected ? "bg-surface font-semibold text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{department.name}</span>
                    <ChevronDown className={cn("size-4 -rotate-90 rtl:rotate-90", selected ? "opacity-100" : "opacity-0")} aria-hidden />
                  </button>
                );
              })}
            </div>
              <Link
                href="/products"
                onClick={close}
                className="mx-3 mt-auto mb-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-semibold text-ink-foreground transition-colors hover:bg-ink/90"
              >
                {t("allProducts")}
              </Link>
            </div>

            <div
              role="tabpanel"
              id={`${baseId}-panel`}
              aria-labelledby={`${baseId}-tab-${active}`}
              className="grid min-h-[22rem] grid-cols-[1fr_13rem] gap-6 p-6"
            >
              <div className="min-w-0">
                <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-border pb-4">
                  <p className="tracking-display text-xl font-bold">{current.name}</p>
                  <Link
                    href={`/categories/${current.slug}`}
                    onClick={close}
                    className="text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
                  >
                    {t("shopDepartment", { name: current.name })}
                  </Link>
                </div>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-5 xl:grid-cols-3">
                  {current.children.map((group) => (
                    <li key={group.slug} className="min-w-0">
                      <Link
                        href={`/categories/${group.slug}`}
                        onClick={close}
                        className="text-sm font-semibold text-foreground hover:text-brand-text"
                      >
                        {group.name}
                      </Link>
                      {group.children.length ? (
                        <ul className="mt-2 space-y-1.5">
                          {group.children.map((leaf) => (
                            <li key={leaf.slug}>
                              <Link
                                href={`/categories/${leaf.slug}`}
                                onClick={close}
                                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                              >
                                {leaf.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
              {current.imageUrl ? (
                <Link
                  href={`/categories/${current.slug}`}
                  onClick={close}
                  tabIndex={-1}
                  aria-hidden
                  className="group block self-start overflow-hidden rounded-2xl bg-image-well"
                >
                  <AppImage
                    src={current.imageUrl}
                    alt=""
                    ratio="4/5"
                    sizes="208px"
                    className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.04]"
                  />
                </Link>
              ) : null}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
