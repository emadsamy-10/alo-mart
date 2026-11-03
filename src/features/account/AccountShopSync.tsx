"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { applyAccountCart, cartStore } from "@/features/cart/store";
import { EMPTY_CART } from "@/features/cart/cart";
import { useMarket } from "@/features/markets/MarketContext";
import { wishlistStore } from "@/features/wishlist/store";
import { EMPTY_WISHLIST } from "@/features/wishlist/wishlist";
import { loadAccountCart, loadAccountWishlist, mergeGuestShop } from "./shop-actions";
import { shopState, useShopNotice } from "./shop-state";

/**
 * Connects the cart and wishlist to the signed-in account (mounted once in
 * the locale layout).
 *
 * Signed in: the stores switch to memory mode, this browser's guest cart and
 * wishlist are moved into the account once (then removed from storage), and
 * the account's own cart/wishlist are loaded — and reloaded when the market
 * changes. Signed out (or the session ended): back to the guest stores; no
 * account data remains in memory or storage.
 */
export function AccountShopSync({ signedIn }: { signedIn: boolean }) {
  const market = useMarket();
  const t = useTranslations("Account.shop");
  const notice = useShopNotice();
  const merged = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (!signedIn) {
      merged.current = false;
      if (cartStore.mode() === "memory" || wishlistStore.mode() === "memory") {
        shopState.setSignedIn(false);
        cartStore.setMode("local");
        wishlistStore.setMode("local");
      }
      return;
    }

    let cancelled = false;
    const guestCart = cartStore.readLocal();
    const guestWishlist = wishlistStore.readLocal();
    if (cartStore.mode() !== "memory") {
      // Keep showing the guest items while the account loads (no flash of empty).
      cartStore.setMode("memory", guestCart);
      wishlistStore.setMode("memory", guestWishlist);
    }
    shopState.setSignedIn(true);

    (async () => {
      const hasGuestData = Object.values(guestCart).some((lines) => lines.length > 0) || guestWishlist.length > 0;
      if (hasGuestData && !merged.current) {
        merged.current = true;
        const report = await mergeGuestShop(guestCart, guestWishlist.map((e) => ({ productId: e.productId })));
        if (report.ok) {
          cartStore.clearLocal();
          wishlistStore.clearLocal();
          const { cartMoved, cartFailed, wishlistMoved } = report.data;
          if (cartFailed > 0) shopState.announce(t("mergedPartly", { failed: cartFailed }));
          else if (cartMoved + wishlistMoved > 0) shopState.announce(t("merged", { count: cartMoved + wishlistMoved }));
          // Server-rendered pages (checkout, account) were rendered before the merge: re-read them.
          if (cartMoved + wishlistMoved > 0) router.refresh();
        } else if (report.signedOut) {
          window.location.reload();
          return;
        } else {
          merged.current = false;
        }
      }
      const [cart, wishlist] = await Promise.all([loadAccountCart(market), loadAccountWishlist()]);
      if (cancelled) return;
      if (cart.ok) applyAccountCart(market, cart.data);
      else if (!cart.signedOut) shopState.announce(t("loadFailed"));
      if (wishlist.ok) wishlistStore.set(wishlist.data);
      if ((!cart.ok && cart.signedOut) || (!wishlist.ok && wishlist.signedOut)) {
        cartStore.set(EMPTY_CART);
        wishlistStore.set(EMPTY_WISHLIST);
        window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, market, t, router]);

  return (
    <div aria-live="polite" role="status" className="sr-only" data-testid="shop-notice">
      {notice}
    </div>
  );
}
