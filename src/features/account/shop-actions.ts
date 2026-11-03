"use server";

import { getLocale } from "next-intl/server";
import { resolveMarket } from "@/features/markets/api";
import type { CartState } from "@/features/cart/cart";
import { MAX_QUANTITY } from "@/features/products/variants";
import { productCardImage } from "@/lib/images";
import type { WishlistEntry } from "@/features/wishlist/wishlist";
import { accountCartSchema, accountWishlistSchema, anySchema } from "./schemas";
import { accountCall, clearSessionToken, readSessionToken } from "./session";
import { cartFromAccount, wishlistFromAccount, type AccountCartView } from "./shop-mapping";

/*
 * The signed-in shopper's cart and wishlist live in their account (API), so
 * they follow them across devices and are gone from this browser after
 * sign-out. The client stores call these actions; each returns the fresh
 * server state (or `signedOut` when the session ended).
 */

export type ShopResult<T> = { ok: true; data: T } | { ok: false; signedOut?: boolean };

const MARKET = /^[A-Z]{2,3}$/;
const imageFor = (url: string | null) => productCardImage({ primary_image_url: url }, "thumbnail")?.src ?? null;

async function context(market?: string) {
  const locale = await getLocale();
  // The market cookie is authoritative; a client-sent code must match an active market.
  const resolved = await resolveMarket(locale);
  const code = market && MARKET.test(market) && resolved.markets.some((m) => m.code === market) ? market : resolved.code;
  return { locale, market: code };
}

async function ended<T>(kind: string | undefined): Promise<ShopResult<T>> {
  if (kind === "unauthorized") {
    await clearSessionToken();
    return { ok: false, signedOut: true };
  }
  return { ok: false };
}

async function cartView(locale: string, market: string): Promise<ShopResult<AccountCartView>> {
  const result = await accountCall("GET", "/user/cart", accountCartSchema, { locale, query: { market } });
  if (!result.ok) return ended(result.error.kind);
  return { ok: true, data: cartFromAccount(result.data, imageFor) };
}

export async function loadAccountCart(market?: string): Promise<ShopResult<AccountCartView>> {
  if (!(await readSessionToken())) return { ok: false, signedOut: true };
  const ctx = await context(market);
  return cartView(ctx.locale, ctx.market);
}

export async function loadAccountWishlist(): Promise<ShopResult<WishlistEntry[]>> {
  if (!(await readSessionToken())) return { ok: false, signedOut: true };
  const ctx = await context();
  const result = await accountCall("GET", "/user/wishlist", accountWishlistSchema, { locale: ctx.locale, query: { market: ctx.market } });
  if (!result.ok) return ended(result.error.kind);
  return { ok: true, data: wishlistFromAccount(result.data, imageFor) };
}

/** Add (merges quantities server-side) then return the market's cart. */
export async function accountCartAdd(market: string, variantId: number, quantity: number): Promise<ShopResult<AccountCartView> & { message?: string }> {
  const ctx = await context(market);
  if (!Number.isInteger(variantId) || variantId <= 0) return { ok: false };
  const qty = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
  const result = await accountCall("POST", "/user/cart/items", anySchema, { locale: ctx.locale, body: { product_variant_id: variantId, quantity: qty, market: ctx.market } });
  if (!result.ok) {
    if (result.error.kind === "unauthorized") return ended(result.error.kind);
    // e.g. out of stock: report the API's message, and resync.
    const fresh = await cartView(ctx.locale, ctx.market);
    return { ...fresh, ok: false, message: result.error.message };
  }
  return cartView(ctx.locale, ctx.market);
}

export async function accountCartUpdate(market: string, itemId: number, quantity: number): Promise<ShopResult<AccountCartView> & { message?: string }> {
  const ctx = await context(market);
  if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false };
  const qty = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
  const result = await accountCall("PUT", `/user/cart/items/${itemId}`, anySchema, { locale: ctx.locale, body: { quantity: qty } });
  if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
  const fresh = await cartView(ctx.locale, ctx.market);
  return result.ok ? fresh : { ...fresh, ok: false, message: result.error.message };
}

export async function accountCartRemove(market: string, itemId: number): Promise<ShopResult<AccountCartView>> {
  const ctx = await context(market);
  if (!Number.isInteger(itemId) || itemId <= 0) return { ok: false };
  const result = await accountCall("DELETE", `/user/cart/items/${itemId}`, anySchema, { locale: ctx.locale });
  if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
  return cartView(ctx.locale, ctx.market);
}

export async function accountCartClear(market: string): Promise<ShopResult<AccountCartView>> {
  const ctx = await context(market);
  const result = await accountCall("DELETE", "/user/cart", anySchema, { locale: ctx.locale, query: { market: ctx.market } });
  if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
  return cartView(ctx.locale, ctx.market);
}

export async function accountWishlistToggle(productId: number, save: boolean): Promise<ShopResult<WishlistEntry[]>> {
  const ctx = await context();
  if (!Number.isInteger(productId) || productId <= 0) return { ok: false };
  const result = save
    ? await accountCall("POST", "/user/wishlist/items", anySchema, { locale: ctx.locale, body: { product_id: productId, market: ctx.market } })
    : await accountCall("DELETE", `/user/wishlist/items/${productId}`, anySchema, { locale: ctx.locale });
  if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
  return loadAccountWishlist();
}

export interface MergeReport {
  cartMoved: number;
  cartFailed: number;
  wishlistMoved: number;
  wishlistFailed: number;
}

/**
 * After sign-in: move this browser's guest cart (every market) and wishlist
 * into the account. Quantities add up with what the account already has
 * (the API merges); saved products are idempotent. Lines the API refuses
 * (out of stock, unavailable) are counted and reported to the shopper. The
 * client clears the guest data once this returns ok — never before — so a
 * failed sign-in sync can retry, and a successful one is never applied twice.
 */
export async function mergeGuestShop(cart: CartState, wishlist: Pick<WishlistEntry, "productId">[]): Promise<ShopResult<MergeReport>> {
  if (!(await readSessionToken())) return { ok: false, signedOut: true };
  const ctx = await context();
  const report: MergeReport = { cartMoved: 0, cartFailed: 0, wishlistMoved: 0, wishlistFailed: 0 };
  const markets = (await resolveMarket(ctx.locale)).markets.map((m) => m.code);

  const lines = Object.entries(cart ?? {})
    .filter(([market]) => markets.includes(market))
    .flatMap(([market, items]) => (Array.isArray(items) ? items.slice(0, 60).map((l) => ({ market, line: l })) : []));
  for (const { market, line } of lines.slice(0, 120)) {
    if (!Number.isInteger(line?.variantId) || !Number.isInteger(line?.quantity)) continue;
    const result = await accountCall("POST", "/user/cart/items", anySchema, {
      locale: ctx.locale,
      body: { product_variant_id: line.variantId, quantity: Math.min(MAX_QUANTITY, Math.max(1, line.quantity)), market },
    });
    if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
    if (result.ok) report.cartMoved++;
    else report.cartFailed++;
  }

  for (const entry of (Array.isArray(wishlist) ? wishlist : []).slice(0, 120)) {
    if (!Number.isInteger(entry?.productId)) continue;
    const result = await accountCall("POST", "/user/wishlist/items", anySchema, { locale: ctx.locale, body: { product_id: entry.productId, market: ctx.market } });
    if (!result.ok && result.error.kind === "unauthorized") return ended(result.error.kind);
    if (result.ok) report.wishlistMoved++;
    else report.wishlistFailed++;
  }
  return { ok: true, data: report };
}
