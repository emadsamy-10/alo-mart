"use client";

import { Heart, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "@/features/wishlist/store";
import { setCartDrawerOpen, useCart } from "./store";

const base =
  "relative grid size-11 shrink-0 place-items-center rounded-full border border-border bg-surface text-foreground shadow-sm transition hover:border-border-strong";

function Badge({ count, testId }: { count: number; testId: string }) {
  if (!count) return null;
  return (
    <span
      data-testid={testId}
      className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.6875rem] font-bold text-brand-foreground tabular-nums ring-2 ring-background"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Wishlist link + cart drawer trigger with live counts (this device). */
export function HeaderShopButtons({ className, showWishlist = true }: { className?: string; showWishlist?: boolean }) {
  const t = useTranslations("Cart");
  const tw = useTranslations("Wishlist");
  const { count } = useCart();
  const wishlist = useWishlist();

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showWishlist ? (
        <Link href="/wishlist" aria-label={tw("open", { count: wishlist.count })} className={base}>
          <Heart className="size-5" aria-hidden />
          <Badge count={wishlist.count} testId="wishlist-count" />
        </Link>
      ) : null}
      <button type="button" onClick={() => setCartDrawerOpen(true)} aria-label={t("open", { count })} className={base} data-testid="cart-button">
        <ShoppingBag className="size-5" aria-hidden />
        <Badge count={count} testId="cart-count" />
      </button>
    </div>
  );
}
