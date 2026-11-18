"use client";

import { useSyncExternalStore } from "react";

/**
 * In-memory state that ties the cart/wishlist stores to the signed-in
 * account. Set by <AccountShopSync>; read by the cart and wishlist hooks.
 * Nothing here is persisted.
 */

/** null until <AccountShopSync> runs; before that, <body data-account> (server-rendered) answers. */
let signedIn: boolean | null = null;
/** market → variant id → account cart item id */
let itemIds: Record<string, Record<number, number>> = {};
let notice: string | null = null;
/** False while a signed-in visitor's account cart and wishlist are loading (the stores still hold this device's guest items). */
let synced = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const shopState = {
  signedIn: () => signedIn ?? (typeof document !== "undefined" && document.body?.dataset.account === "1"),
  setSignedIn(value: boolean) {
    signedIn = value;
    if (!value) itemIds = {};
    emit();
  },
  synced: () => synced,
  setSynced(value: boolean) {
    synced = value;
    emit();
  },
  /** Signed in, but the account's cart and wishlist have not arrived yet: don't show the device's (usually empty) guest lists. */
  accountPending: () => shopState.signedIn() && !synced,
  itemId: (market: string, variantId: number): number | undefined => itemIds[market]?.[variantId],
  setItemIds(market: string, ids: Record<number, number>) {
    itemIds = { ...itemIds, [market]: ids };
  },
  notice: () => notice,
  /** A short message for the polite live region (e.g. "This item is out of stock"). */
  announce(message: string | null) {
    notice = message;
    emit();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useShopNotice(): string | null {
  return useSyncExternalStore(shopState.subscribe, shopState.notice, () => null);
}

export function useAccountPending(): boolean {
  return useSyncExternalStore(shopState.subscribe, shopState.accountPending, () => false);
}

export function useSignedIn(): boolean {
  return useSyncExternalStore(shopState.subscribe, shopState.signedIn, () => false);
}
