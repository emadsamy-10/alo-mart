"use client";

import { Heart, Home, LayoutGrid, ShoppingCart, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { setCartDrawerOpen, useCart } from "@/features/cart/store";
import { useWishlist } from "@/features/wishlist/store";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { setMobileMenuOpen } from "./mobile-menu-store";

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

// Below 400px items size to their labels (one line each): equal fifths are too narrow for "Departments" / "تسجيل الدخول".
const ITEM =
  "relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors max-[399px]:flex-auto max-[399px]:whitespace-nowrap";

function Count({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span aria-hidden className="absolute -end-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.625rem] font-bold text-brand-foreground tabular-nums ring-2 ring-surface">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/**
 * Phone and tablet navigation at the thumb. Not shown where a page has its own
 * bottom action (the product purchase bar) or needs full focus (checkout).
 */
export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations("Header");
  const tc = useTranslations("Common");
  const ta = useTranslations("Account.nav");
  const tCart = useTranslations("Cart");
  const tw = useTranslations("Wishlist");
  const pathname = usePathname();
  const { count } = useCart();
  const wishlist = useWishlist();
  const hydrated = useHydrated();

  if (/^\/products\/[^/]+/.test(pathname) || pathname.startsWith("/checkout")) return null;

  const tone = (active: boolean) => (active ? "text-brand-text" : "text-muted-foreground hover:text-foreground");

  return (
    <nav
      aria-label={t("quickNavigation")}
      data-testid="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden"
    >
      <div className="mx-auto flex h-15 max-w-2xl items-stretch">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined} className={cn(ITEM, tone(pathname === "/"))}>
          <Home className="size-5.5" aria-hidden />
          {tc("home")}
        </Link>
        <button type="button" onClick={() => setMobileMenuOpen(true)} className={cn(ITEM, tone(false))}>
          <LayoutGrid className="size-5.5" aria-hidden />
          {t("departments")}
        </button>
        <button type="button" onClick={() => setCartDrawerOpen(true)} className={cn(ITEM, tone(false))}>
          <span className="relative">
            <ShoppingCart className="size-5.5" aria-hidden />
            <Count value={hydrated ? count : 0} />
          </span>
          {t("cart")}
          <span className="sr-only">{tCart("count", { count: hydrated ? count : 0 })}</span>
        </button>
        <Link href="/wishlist" aria-current={pathname === "/wishlist" ? "page" : undefined} className={cn(ITEM, tone(pathname === "/wishlist"))}>
          <span className="relative">
            <Heart className="size-5.5" aria-hidden />
            <Count value={hydrated ? wishlist.count : 0} />
          </span>
          {t("wishlist")}
          <span className="sr-only">{tw("count", { count: hydrated ? wishlist.count : 0 })}</span>
        </Link>
        <Link
          href={signedIn ? "/account" : "/login"}
          aria-current={pathname.startsWith("/account") ? "page" : undefined}
          className={cn(ITEM, tone(pathname.startsWith("/account")))}
        >
          <UserRound className="size-5.5" aria-hidden />
          {signedIn ? t("account") : ta("signIn")}
        </Link>
      </div>
    </nav>
  );
}
