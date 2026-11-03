"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { accountCartAdd, accountCartClear, accountCartRemove, accountCartUpdate, type ShopResult } from "@/features/account/shop-actions";
import type { AccountCartView } from "@/features/account/shop-mapping";
import { shopState } from "@/features/account/shop-state";
import { useMarket } from "@/features/markets/MarketContext";
import { createPersistentStore, usePersistentStore } from "@/lib/persistent-store";
import {
  EMPTY_CART,
  addLine,
  applyRefresh,
  clearMarket,
  itemCount,
  parseCart,
  removeLine,
  setQuantity,
  subtotal,
  type CartLine,
  type LineRefresh,
} from "./cart";

/** Versioned key: a future format change can migrate or ignore old data. */
export const cartStore = createPersistentStore("alo_cart_v1", EMPTY_CART, parseCart);

const NO_LINES: CartLine[] = [];

/**
 * Signed in? Then make sure the store is in account (memory) mode before a
 * change — a product page can hydrate before <AccountShopSync> runs, and a
 * change must never land in the guest storage (it would be merged twice).
 */
function accountMode(): boolean {
  if (!shopState.signedIn()) return false;
  if (cartStore.mode() === "local") cartStore.setMode("memory", cartStore.readLocal());
  return true;
}

/** Replace one market's lines with the account cart the API returned. */
export function applyAccountCart(market: string, view: AccountCartView) {
  shopState.setItemIds(market, view.itemIds);
  cartStore.set((s) => ({ ...s, [market]: view.lines }));
}

/**
 * Signed in: the change shows at once (optimistic), then the account cart
 * from the API replaces it — the server is the source of truth, so a refused
 * change (e.g. out of stock) is rolled back and announced.
 */
async function syncAccount(market: string, request: Promise<ShopResult<AccountCartView> & { message?: string }>) {
  const result = await request;
  if ("data" in result && result.data) applyAccountCart(market, result.data);
  if (!result.ok) {
    if (result.signedOut) window.location.reload();
    else shopState.announce(("message" in result && result.message) || null);
  }
}

/** The current market's cart, plus its operations. Shared by every consumer. */
export function useCart() {
  const market = useMarket();
  const state = usePersistentStore(cartStore, EMPTY_CART);
  const lines = state[market] ?? NO_LINES;

  const add = useCallback(
    (line: Omit<CartLine, "addedAt" | "issue">) => {
      const account = accountMode();
      cartStore.set((s) => addLine(s, market, line));
      if (account) void syncAccount(market, accountCartAdd(market, line.variantId, line.quantity));
    },
    [market],
  );
  const update = useCallback(
    (variantId: number, quantity: number) => {
      const account = accountMode();
      cartStore.set((s) => setQuantity(s, market, variantId, quantity));
      const id = shopState.itemId(market, variantId);
      if (account && id) void syncAccount(market, accountCartUpdate(market, id, quantity));
    },
    [market],
  );
  const remove = useCallback(
    (variantId: number) => {
      const account = accountMode();
      cartStore.set((s) => removeLine(s, market, variantId));
      const id = shopState.itemId(market, variantId);
      if (account && id) void syncAccount(market, accountCartRemove(market, id));
    },
    [market],
  );
  const clear = useCallback(() => {
    const account = accountMode();
    cartStore.set((s) => clearMarket(s, market));
    if (account) void syncAccount(market, accountCartClear(market));
  }, [market]);
  const refresh = useCallback((r: LineRefresh[]) => cartStore.set((s) => applyRefresh(s, market, r)), [market]);

  return useMemo(
    () => ({ market, lines, count: itemCount(lines), subtotal: subtotal(lines), add, update, remove, clear, refresh }),
    [market, lines, add, update, remove, clear, refresh],
  );
}

/* Drawer visibility: in-memory only, shared by the header button, the
   add-to-cart button and the drawer itself. */
let drawerOpen = false;
const drawerListeners = new Set<() => void>();
export function setCartDrawerOpen(open: boolean) {
  drawerOpen = open;
  drawerListeners.forEach((l) => l());
}
export function useCartDrawer(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    (l) => {
      drawerListeners.add(l);
      return () => drawerListeners.delete(l);
    },
    () => drawerOpen,
    () => false,
  );
  return [open, setCartDrawerOpen];
}
