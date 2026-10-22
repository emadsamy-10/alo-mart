"use client";

import { Heart, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { buttonClass } from "@/components/ui/button";
import { refreshWishlist, type WishlistSnapshot } from "@/features/cart/actions";
import { formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "./store";

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/** Saved products (this device), with current-market price and availability. */
export function WishlistPageView() {
  const t = useTranslations("Wishlist");
  const locale = useLocale();
  const hydrated = useHydrated();
  const { entries, remove } = useWishlist();
  const [snapshots, setSnapshots] = useState<Record<string, WishlistSnapshot>>({});
  const [pending, startTransition] = useTransition();
  const key = entries.map((e) => e.slug).join(",");

  useEffect(() => {
    if (!key) return;
    startTransition(async () => {
      try {
        const rows = await refreshWishlist(key.split(","));
        setSnapshots(Object.fromEntries(rows.map((r) => [r.slug, r])));
      } catch {
        // Keep the stored snapshot on network failure.
      }
    });
  }, [key]);

  if (!hydrated) return <div className="min-h-64" aria-busy="true" />;

  if (!entries.length) {
    return (
      <div className="flex flex-col items-center rounded-panel border border-border bg-surface px-6 py-16 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-surface-muted" aria-hidden>
          <Heart className="size-7" />
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
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5" aria-busy={pending}>
      {entries.map((entry) => {
        const snap = snapshots[entry.slug];
        const unavailable = snap?.status === "unavailable";
        const price = snap?.price ? formatMoney(snap.price.amount, snap.price.currency, locale) : null;
        return (
          <li key={entry.productId} data-testid="wishlist-item">
            <article className={cn("relative flex h-full flex-col rounded-card bg-surface p-2 shadow-card ring-1 ring-border/70 lg:p-2.5", unavailable && "opacity-75")}>
              <div className="relative overflow-hidden rounded-well bg-image-well">
                <AppImage src={snap?.imageUrl ?? entry.imageUrl} alt={entry.name} ratio="1/1" sizes="(min-width: 1024px) 24vw, 48vw" />
              </div>
              <div className="flex flex-1 flex-col px-1.5 pt-3 pb-1.5">
                <h3 className="line-clamp-2 text-[0.9375rem] font-semibold">
                  {unavailable ? (
                    entry.name
                  ) : (
                    <Link href={`/products/${entry.slug}`} className="hover:text-brand-text">
                      {snap?.name ?? entry.name}
                    </Link>
                  )}
                </h3>
                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                  <div>
                    {unavailable ? (
                      <p className="text-sm font-semibold text-danger">{t("unavailable")}</p>
                    ) : price ? (
                      <p className="text-lg font-extrabold text-brand-text tabular-nums">{snap?.price?.maxAmount ? t("from", { price }) : price}</p>
                    ) : null}
                    {snap?.status === "ok" && snap.inStock === false ? <p className="text-xs text-muted-foreground">{t("outOfStock")}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(entry.productId)}
                    aria-label={t("removeItem", { name: entry.name })}
                    className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
