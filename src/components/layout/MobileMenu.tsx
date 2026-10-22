"use client";

import { ChevronDown, Heart, LayoutGrid, Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { NavCategory } from "./nav-types";

/**
 * Mobile navigation drawer (slides in from the inline-end edge, mirrored in
 * RTL). Departments use native <details> so the accordion is accessible and
 * works with zero extra JS state.
 */
export function MobileMenu({ departments }: { departments: NavCategory[] }) {
  const t = useTranslations("Header");
  const tc = useTranslations("Common");
  const tp = useTranslations("Preferences");
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={t("openMenu")}
        className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm"
      >
        <Menu className="size-5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content className="sheet-end fixed inset-y-0 end-0 z-50 flex w-[min(24rem,88vw)] flex-col bg-background shadow-popover outline-none">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-lg font-bold">{t("menu")}</Dialog.Title>
            <Dialog.Close
              aria-label={tc("close")}
              className="inline-flex size-11 items-center justify-center rounded-full bg-surface-muted text-foreground"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{t("mainNavigation")}</Dialog.Description>

          <nav aria-label={t("departments")} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4">
            <ul className="mb-4 grid grid-cols-2 gap-2">
              <li>
                <Link href="/products" onClick={close} className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3 text-sm font-semibold shadow-card">
                  <LayoutGrid className="size-4 text-brand-text" aria-hidden />
                  {t("allProducts")}
                </Link>
              </li>
              <li>
                <Link href="/wishlist" onClick={close} className="flex min-h-12 items-center gap-2 rounded-2xl bg-surface px-3 text-sm font-semibold shadow-card">
                  <Heart className="size-4 text-brand-text" aria-hidden />
                  {t("wishlist")}
                </Link>
              </li>
            </ul>
            <p className="px-2 pb-2 text-sm font-semibold text-muted-foreground">{t("departments")}</p>
            <ul className="space-y-1">
              {departments.map((department) => (
                <li key={department.slug}>
                  <details className="group rounded-2xl open:bg-surface open:shadow-card">
                    <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-2xl px-3 text-base font-semibold [&::-webkit-details-marker]:hidden">
                      {department.name}
                      <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                    </summary>
                    <div className="px-3 pb-3">
                      <Link
                        href={`/categories/${department.slug}`}
                        onClick={close}
                        className="mb-2 inline-flex h-11 items-center text-sm font-semibold text-brand-text"
                      >
                        {t("shopDepartment", { name: department.name })}
                      </Link>
                      <ul className="space-y-3 border-s border-border ps-3">
                        {department.children.map((group) => (
                          <li key={group.slug}>
                            <Link href={`/categories/${group.slug}`} onClick={close} className="inline-flex min-h-11 items-center text-sm font-semibold">
                              {group.name}
                            </Link>
                            {group.children.length ? (
                              <ul className="mt-0.5 flex flex-wrap gap-1.5">
                                {group.children.map((leaf) => (
                                  <li key={leaf.slug}>
                                    <Link
                                      href={`/categories/${leaf.slug}`}
                                      onClick={close}
                                      className="inline-flex h-11 items-center rounded-full bg-surface-muted px-4 text-[0.8125rem] text-foreground"
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
                  </details>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-4 border-t border-border px-5 py-5">
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">{tp("language")}</p>
              <LanguageSwitcher variant="list" />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">{tp("theme")}</p>
              <ThemeSwitcher variant="segmented" />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
