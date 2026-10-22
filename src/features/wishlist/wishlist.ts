/**
 * Guest wishlist model (pure). Entries are keyed by PRODUCT id — the same key
 * the account wishlist API uses (`DELETE /v1/user/wishlist/items/{product}`),
 * so a later sign-in can sync these entries. Not market-specific: a saved
 * product's price and availability are re-read for the current market when
 * the wishlist is viewed.
 */

export interface WishlistEntry {
  productId: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  addedAt: number;
}

export type WishlistState = WishlistEntry[];
export const EMPTY_WISHLIST: WishlistState = [];

export function isSaved(state: WishlistState, productId: number): boolean {
  return state.some((e) => e.productId === productId);
}

/** Add if absent, remove if present. Never duplicates. Newest first. */
export function toggleEntry(state: WishlistState, entry: Omit<WishlistEntry, "addedAt">, now = Date.now()): WishlistState {
  return isSaved(state, entry.productId)
    ? state.filter((e) => e.productId !== entry.productId)
    : [{ ...entry, addedAt: now }, ...state];
}

export function removeEntry(state: WishlistState, productId: number): WishlistState {
  return state.filter((e) => e.productId !== productId);
}

export function parseWishlist(raw: unknown): WishlistState {
  if (!Array.isArray(raw)) return EMPTY_WISHLIST;
  const seen = new Set<number>();
  return raw.filter((e): e is WishlistEntry => {
    const ok =
      !!e &&
      typeof e === "object" &&
      Number.isInteger((e as WishlistEntry).productId) &&
      typeof (e as WishlistEntry).slug === "string" &&
      typeof (e as WishlistEntry).name === "string" &&
      !seen.has((e as WishlistEntry).productId);
    if (ok) seen.add((e as WishlistEntry).productId);
    return ok;
  });
}
