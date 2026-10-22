"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
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

/** The current market's cart, plus its operations. Shared by every consumer. */
export function useCart() {
  const market = useMarket();
  const state = usePersistentStore(cartStore, EMPTY_CART);
  const lines = state[market] ?? NO_LINES;

  const add = useCallback((line: Omit<CartLine, "addedAt" | "issue">) => cartStore.set((s) => addLine(s, market, line)), [market]);
  const update = useCallback((variantId: number, quantity: number) => cartStore.set((s) => setQuantity(s, market, variantId, quantity)), [market]);
  const remove = useCallback((variantId: number) => cartStore.set((s) => removeLine(s, market, variantId)), [market]);
  const clear = useCallback(() => cartStore.set((s) => clearMarket(s, market)), [market]);
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
