"use client";

import { useCallback, useMemo } from "react";
import { createPersistentStore, usePersistentStore } from "@/lib/persistent-store";
import { EMPTY_WISHLIST, isSaved, parseWishlist, removeEntry, toggleEntry, type WishlistEntry } from "./wishlist";

export const wishlistStore = createPersistentStore("alo_wishlist_v1", EMPTY_WISHLIST, parseWishlist);

export function useWishlist() {
  const entries = usePersistentStore(wishlistStore, EMPTY_WISHLIST);
  const toggle = useCallback((entry: Omit<WishlistEntry, "addedAt">) => wishlistStore.set((s) => toggleEntry(s, entry)), []);
  const remove = useCallback((productId: number) => wishlistStore.set((s) => removeEntry(s, productId)), []);
  const has = useCallback((productId: number) => isSaved(entries, productId), [entries]);
  return useMemo(() => ({ entries, count: entries.length, toggle, remove, has }), [entries, toggle, remove, has]);
}
