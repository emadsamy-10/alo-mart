"use client";

import { useCallback, useMemo } from "react";
import { accountWishlistToggle } from "@/features/account/shop-actions";
import { shopState } from "@/features/account/shop-state";
import { createPersistentStore, usePersistentStore } from "@/lib/persistent-store";
import { EMPTY_WISHLIST, isSaved, parseWishlist, removeEntry, toggleEntry, type WishlistEntry } from "./wishlist";

export const wishlistStore = createPersistentStore("alo_wishlist_v1", EMPTY_WISHLIST, parseWishlist);

/** Signed in → account (memory) mode first, so the change never lands in guest storage. */
function accountMode(): boolean {
  if (!shopState.signedIn()) return false;
  if (wishlistStore.mode() === "local") wishlistStore.setMode("memory", wishlistStore.readLocal());
  return true;
}

/** Signed in: optimistic change, then the account wishlist from the API replaces it. */
async function syncAccount(productId: number, save: boolean) {
  const result = await accountWishlistToggle(productId, save);
  if (result.ok) wishlistStore.set(result.data);
  else if (result.signedOut) window.location.reload();
}

export function useWishlist() {
  const entries = usePersistentStore(wishlistStore, EMPTY_WISHLIST);
  const toggle = useCallback((entry: Omit<WishlistEntry, "addedAt">) => {
    const account = accountMode();
    const save = !isSaved(wishlistStore.get(), entry.productId);
    wishlistStore.set((s) => toggleEntry(s, entry));
    if (account) void syncAccount(entry.productId, save);
  }, []);
  const remove = useCallback((productId: number) => {
    const account = accountMode();
    wishlistStore.set((s) => removeEntry(s, productId));
    if (account) void syncAccount(productId, false);
  }, []);
  const has = useCallback((productId: number) => isSaved(entries, productId), [entries]);
  return useMemo(() => ({ entries, count: entries.length, toggle, remove, has }), [entries, toggle, remove, has]);
}
