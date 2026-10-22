import { MAX_QUANTITY, clampQuantity } from "@/features/products/variants";

/**
 * Guest cart model (pure). Lines are identified by VARIANT id — the same key
 * the account cart API uses (`product_variant_id` + `quantity`), so a later
 * sign-in can push these lines to `POST /v1/user/cart/items` unchanged.
 *
 * Carts are kept per market: prices and availability are market-specific, so
 * switching market shows that market's cart and never mixes currencies.
 *
 * A local cart reserves nothing. Prices are snapshots refreshed from the API
 * whenever the cart is viewed (see actions.ts).
 */

export interface CartCurrency {
  code: string;
  symbol: string | null;
  decimal_places: number;
}

export interface CartLine {
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  /** "Black / L"; empty for products without options. */
  variantLabel: string;
  imageUrl: string | null;
  /** Selling price per unit (decimal string from the API). */
  unitPrice: string;
  /** Regular price when the unit price is a real reduction. */
  regularPrice: string | null;
  currency: CartCurrency;
  quantity: number;
  /** Set when a refresh found the variant gone or out of stock. */
  issue?: "unavailable" | "out_of_stock" | null;
  addedAt: number;
}

/** market code → lines */
export type CartState = Record<string, CartLine[]>;
export const EMPTY_CART: CartState = {};

export function addLine(state: CartState, market: string, line: Omit<CartLine, "addedAt" | "issue">, now = Date.now()): CartState {
  const lines = state[market] ?? [];
  const existing = lines.find((l) => l.variantId === line.variantId);
  const next = existing
    ? lines.map((l) =>
        l.variantId === line.variantId
          ? { ...l, ...line, quantity: Math.min(MAX_QUANTITY, l.quantity + clampQuantity(line.quantity)), addedAt: l.addedAt, issue: null }
          : l,
      )
    : [...lines, { ...line, quantity: clampQuantity(line.quantity), addedAt: now, issue: null }];
  return { ...state, [market]: next };
}

export function setQuantity(state: CartState, market: string, variantId: number, quantity: number): CartState {
  const lines = state[market] ?? [];
  return { ...state, [market]: lines.map((l) => (l.variantId === variantId ? { ...l, quantity: clampQuantity(quantity) } : l)) };
}

export function removeLine(state: CartState, market: string, variantId: number): CartState {
  return { ...state, [market]: (state[market] ?? []).filter((l) => l.variantId !== variantId) };
}

export function clearMarket(state: CartState, market: string): CartState {
  const next = { ...state };
  delete next[market];
  return next;
}

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Exact subtotal in minor units (avoids float drift), excluding lines with issues. */
export function subtotal(lines: CartLine[]): { amount: string; currency: CartCurrency } | null {
  const payable = lines.filter((l) => !l.issue);
  if (payable.length === 0) return null;
  const currency = payable[0].currency;
  const scale = 10 ** currency.decimal_places;
  const minor = payable.reduce((sum, l) => sum + Math.round(Number(l.unitPrice) * scale) * l.quantity, 0);
  return { amount: (minor / scale).toFixed(currency.decimal_places), currency };
}

export interface LineRefresh {
  variantId: number;
  status: "ok" | "unavailable" | "out_of_stock";
  unitPrice?: string;
  regularPrice?: string | null;
}

/** Apply fresh API facts to the snapshot: new prices, flagged stale lines. */
export function applyRefresh(state: CartState, market: string, refresh: LineRefresh[]): CartState {
  const byId = new Map(refresh.map((r) => [r.variantId, r]));
  const lines = (state[market] ?? []).map((l) => {
    const r = byId.get(l.variantId);
    if (!r) return l;
    if (r.status !== "ok") return { ...l, issue: r.status };
    return { ...l, issue: null, unitPrice: r.unitPrice ?? l.unitPrice, regularPrice: r.regularPrice ?? null };
  });
  return { ...state, [market]: lines };
}

/** Validate untrusted storage content; drops malformed lines. */
export function parseCart(raw: unknown): CartState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return EMPTY_CART;
  const out: CartState = {};
  for (const [market, lines] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[A-Z]{2,3}$/.test(market) || !Array.isArray(lines)) continue;
    const valid = lines.filter(
      (l): l is CartLine =>
        !!l &&
        typeof l === "object" &&
        Number.isInteger((l as CartLine).variantId) &&
        typeof (l as CartLine).slug === "string" &&
        typeof (l as CartLine).name === "string" &&
        typeof (l as CartLine).unitPrice === "string" &&
        Number.isInteger((l as CartLine).quantity) &&
        (l as CartLine).quantity >= 1 &&
        !!(l as CartLine).currency &&
        typeof (l as CartLine).currency.code === "string",
    );
    if (valid.length) out[market] = valid.map((l) => ({ ...l, quantity: clampQuantity(l.quantity) }));
  }
  return out;
}
