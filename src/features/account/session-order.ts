import "server-only";
import { createHash } from "node:crypto";
import { readSessionToken } from "./session";

/*
 * Runs a signed-in shopper's cart/wishlist operations one after another, in arrival order, inside this
 * server process: a batch of writes sent while leaving a page finishes before the next page's account
 * load reads the cart, and a "save" is never overtaken by the "remove" that followed it. Keyed by a hash
 * of the session token (no raw token kept). Guests have no account state and are not ordered.
 *
 * DEPLOYMENT LIMIT: this order holds within ONE Node.js process (`next start`, as shipped). With several
 * processes/replicas behind a load balancer, writes flushed while leaving a page (one batch still in flight)
 * could be applied by two instances out of order, and the next page's account load could briefly read the
 * cart before them. Each tab still sends one batch at a time, and the session-fingerprint check below is
 * stateless (safe on any number of instances). Multi-instance hosting needs a shared lock (e.g. Redis) or
 * sticky sessions before this is relied on.
 */
type Chains = Map<string, Promise<unknown>>;
const store = globalThis as typeof globalThis & { __aloShopOrder?: Chains };
const chains: Chains = (store.__aloShopOrder ??= new Map());

/**
 * A short one-way fingerprint of the session token. The page carries it (`<body data-session>`), each
 * cart/wishlist write sends it back, and the `shop-sync` route refuses writes whose page was rendered for
 * another session — a tab still showing customer A must not write into customer B's account after an
 * account switch in another tab. Not the token: it cannot be used to authenticate.
 */
export function sessionFingerprint(token: string): string {
  return createHash("sha256").update(`alo-shop-session:${token}`).digest("hex").slice(0, 24);
}

export async function currentSessionFingerprint(): Promise<string | null> {
  const token = await readSessionToken();
  return token ? sessionFingerprint(token) : null;
}

export async function inSessionOrder<T>(work: () => Promise<T>): Promise<T> {
  const token = await readSessionToken();
  if (!token) return work();
  const key = createHash("sha256").update(token).digest("hex");
  const run = (chains.get(key) ?? Promise.resolve()).then(work, work);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, tail);
  void tail.then(() => {
    if (chains.get(key) === tail) chains.delete(key);
  });
  return run;
}
