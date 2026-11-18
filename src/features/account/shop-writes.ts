"use client";

import type { ShopResult } from "./shop-actions";

/*
 * Client side of the signed-in shopper's cart/wishlist writes (route `/[locale]/shop-sync`).
 *
 *  - Order: one request in flight at a time; writes made meanwhile go out together in the next batch,
 *    and the server applies a batch in order — a "save" is never overtaken by the "remove" after it.
 *  - Leaving the page: requests are keep-alive (the browser completes them after the page is gone), and
 *    on `pagehide` every write still waiting is sent at once as a final keep-alive batch. Before this, the
 *    writes were server actions queued one at a time, and a full navigation dropped the queued ones
 *    (journey test 70: an Add to cart behind two wishlist saves never reached the account).
 */
export type ShopOp =
  | { type: "cartAdd"; market: string; variantId: number; quantity: number }
  | { type: "cartUpdate"; market: string; itemId: number; quantity: number }
  | { type: "cartRemove"; market: string; itemId: number }
  | { type: "cartClear"; market: string }
  | { type: "wishlistToggle"; productId: number; save: boolean };

/** As sent: with the session the page was rendered for (`<body data-session>`), checked by the route. */
type SentOp = ShopOp & { session: string };
type Pending = { op: SentOp; resolve: (result: unknown) => void };

let waiting: Pending[] = [];
let inFlight = false;
let listening = false;

function endpoint(): string {
  const lang = document.documentElement.lang === "ar" ? "ar" : "en";
  return `/${lang}/shop-sync`;
}

async function post(ops: SentOp[]): Promise<unknown[]> {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ops }),
    credentials: "same-origin",
    keepalive: true,
  });
  if (!response.ok) throw new Error(`shop-sync ${response.status}`);
  const body = (await response.json()) as { results?: unknown[] };
  return Array.isArray(body.results) ? body.results : [];
}

async function pump(): Promise<void> {
  if (inFlight || waiting.length === 0) return;
  inFlight = true;
  const batch = waiting;
  waiting = [];
  try {
    const results = await post(batch.map((p) => p.op));
    batch.forEach((p, i) => p.resolve(results[i] ?? { ok: false }));
  } catch {
    // Offline or unreachable: report failure; the next account load shows the true state.
    batch.forEach((p) => p.resolve({ ok: false }));
  } finally {
    inFlight = false;
    void pump();
  }
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("pagehide", () => {
    if (waiting.length === 0) return;
    const batch = waiting;
    waiting = [];
    // The page is going away: send everything still waiting now (keep-alive), in order.
    void post(batch.map((p) => p.op)).catch(() => undefined);
  });
}

export function sendShopWrite<T extends ShopResult<unknown>>(op: ShopOp): Promise<T> {
  listen();
  return new Promise<T>((resolve) => {
    waiting.push({ op: { ...op, session: document.body.dataset.session ?? "" }, resolve: resolve as (result: unknown) => void });
    void pump();
  });
}
