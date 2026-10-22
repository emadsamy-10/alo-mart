"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { CartLineItem, CartSummary, useCartRefresh } from "./CartLines";
import { useCart } from "./store";

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/** Full cart page body (this device's guest cart for the current market). */
export function CartPageView() {
  const t = useTranslations("Cart");
  const hydrated = useHydrated();
  const { lines, clear } = useCart();
  const refreshing = useCartRefresh();

  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;

  if (!lines.length) {
    return (
      <div className="flex flex-col items-center rounded-panel border border-border bg-surface px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-surface-muted" aria-hidden>
          <ShoppingBag className="size-7" />
        </span>
        <h2 className="mt-5 text-xl font-bold">{t("emptyTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("emptyBody")}</p>
        <Link href="/products" className={buttonClass({ variant: "primary" }, "mt-6")}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section aria-labelledby="cart-items" className="rounded-panel bg-surface px-5 shadow-card ring-1 ring-border/70 sm:px-7">
        <div className="flex items-center justify-between border-b border-border py-4">
          <h2 id="cart-items" className="text-lg font-bold">
            {t("items")}
          </h2>
          <button type="button" onClick={clear} className="min-h-10 text-sm font-semibold text-muted-foreground hover:text-danger">
            {t("clear")}
          </button>
        </div>
        <ul className="divide-y divide-border" aria-busy={refreshing}>
          {lines.map((line) => (
            <CartLineItem key={line.variantId} line={line} />
          ))}
        </ul>
      </section>
      <aside className="rounded-panel bg-surface p-6 shadow-card ring-1 ring-border/70 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)]">
        <CartSummary />
        <p className="mt-4 rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-muted-foreground">{t("localNote")}</p>
        <Link href="/products" className={buttonClass({ variant: "outline" }, "mt-5 w-full")}>
          {t("continue")}
        </Link>
      </aside>
    </div>
  );
}
