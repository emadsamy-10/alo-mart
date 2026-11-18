"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ShopResult } from "@/features/account/shop-actions";
import { sendShopWrite } from "@/features/account/shop-writes";
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
type CartWrite = ShopResult<AccountCartView> & { message?: string };

async function syncAccount(market: string, request: Promise<CartWrite>) {
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
      if (account) void syncAccount(market, sendShopWrite<CartWrite>({ type: "cartAdd", market, variantId: line.variantId, quantity: line.quantity }));
    },
    [market],
  );
  const update = useCallback(
    (variantId: number, quantity: number) => {
      const account = accountMode();
      cartStore.set((s) => setQuantity(s, market, variantId, quantity));
      const id = shopState.itemId(market, variantId);
      if (account && id) void syncAccount(market, sendShopWrite<CartWrite>({ type: "cartUpdate", market, itemId: id, quantity }));
    },
    [market],
  );
  const remove = useCallback(
    (variantId: number) => {
      const account = accountMode();
      cartStore.set((s) => removeLine(s, market, variantId));
      const id = shopState.itemId(market, variantId);
      if (account && id) void syncAccount(market, sendShopWrite<CartWrite>({ type: "cartRemove", market, itemId: id }));
    },
    [market],
  );
  const clear = useCallback(() => {
    const account = accountMode();
    cartStore.set((s) => clearMarket(s, market));
    if (account) void syncAccount(market, sendShopWrite<CartWrite>({ type: "cartClear", market }));
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
/** The control that opened the drawer (header cart, Add to cart, quick add…): focus goes back there on close. */
let drawerReturnFocus: HTMLElement | null = null;
const drawerListeners = new Set<() => void>();
export function setCartDrawerOpen(open: boolean) {
  if (open && !drawerOpen && typeof document !== "undefined") {
    drawerReturnFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  }
  drawerOpen = open;
  drawerListeners.forEach((l) => l());
}
/** Takes (and forgets) where focus should return; call with nothing to forget it, e.g. when leaving via a link. */
export function takeDrawerReturnFocus(): HTMLElement | null {
  const element = drawerReturnFocus;
  drawerReturnFocus = null;
  return element;
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
