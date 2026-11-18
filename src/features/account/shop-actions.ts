"use server";

import type { CartState } from "@/features/cart/cart";
import type { WishlistEntry } from "@/features/wishlist/wishlist";
import { inSessionOrder } from "./session-order";
import * as core from "./shop-core";
import type { MergeReport, ShopResult } from "./shop-core";
import type { AccountCartView } from "./shop-mapping";

/*
 * The signed-in shopper's cart and wishlist as server actions (loads, sign-in merge). Every call runs in
 * the shopper's session order, so a load never overtakes writes still being applied — e.g. writes the
 * previous page sent while it was being left (see the `shop-sync` route and `shop-writes.ts`).
 */

export type { MergeReport, ShopResult };

export async function loadAccountCart(market?: string): Promise<ShopResult<AccountCartView>> {
  return inSessionOrder(() => core.loadAccountCart(market));
}

export async function loadAccountWishlist(): Promise<ShopResult<WishlistEntry[]>> {
  return inSessionOrder(() => core.loadAccountWishlist());
}

export async function accountCartAdd(market: string, variantId: number, quantity: number) {
  return inSessionOrder(() => core.accountCartAdd(market, variantId, quantity));
}

export async function accountCartUpdate(market: string, itemId: number, quantity: number) {
  return inSessionOrder(() => core.accountCartUpdate(market, itemId, quantity));
}

export async function accountCartRemove(market: string, itemId: number) {
  return inSessionOrder(() => core.accountCartRemove(market, itemId));
}

export async function accountCartClear(market: string) {
  return inSessionOrder(() => core.accountCartClear(market));
}

export async function accountWishlistToggle(productId: number, save: boolean) {
  return inSessionOrder(() => core.accountWishlistToggle(productId, save));
}

export async function mergeGuestShop(cart: CartState, wishlist: Pick<WishlistEntry, "productId">[]): Promise<ShopResult<MergeReport>> {
  return inSessionOrder(() => core.mergeGuestShop(cart, wishlist));
}
