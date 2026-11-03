"use client";

import { useSyncExternalStore } from "react";

/**
 * A tiny localStorage-backed store shared by every component that reads the
 * same key (cart, wishlist): one source of truth, no state library.
 *
 * - SSR-safe: the server snapshot is the empty value, so badges hydrate
 *   without mismatches and fill in after hydration.
 * - Syncs across tabs through the `storage` event.
 * - Tolerates blocked storage (private mode, quota): state stays in memory.
 * - Corrupt or foreign data falls back to the empty value via `parse`.
 * - "memory" mode (signed-in shoppers): state comes from the account API and
 *   is held in memory only — nothing account-specific is written to this
 *   browser's storage, and the guest data in storage is left untouched.
 */
export type StoreMode = "local" | "memory";

export interface PersistentStore<T> {
  get(): T;
  set(update: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
  mode(): StoreMode;
  /** Switch backend; memory mode starts from `initial`, local mode re-reads storage. */
  setMode(mode: StoreMode, initial?: T): void;
  /** The guest data in storage, whatever the current mode. */
  readLocal(): T;
  /** Remove the guest data from storage (after it moved into the account). */
  clearLocal(): void;
}

export function createPersistentStore<T>(key: string, empty: T, parse: (raw: unknown) => T): PersistentStore<T> {
  let cache: T | undefined;
  let mode: StoreMode = "local";
  const listeners = new Set<() => void>();

  const readLocal = (): T => {
    if (typeof window === "undefined") return empty;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? parse(JSON.parse(raw)) : empty;
    } catch {
      return empty;
    }
  };

  const read = (): T => {
    if (cache !== undefined) return cache;
    if (mode === "memory") return empty;
    cache = readLocal();
    return cache;
  };

  const emit = () => listeners.forEach((l) => l());

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== key || mode === "memory") return;
      cache = undefined;
      emit();
    });
  }

  return {
    get: read,
    set(update) {
      const next = typeof update === "function" ? (update as (c: T) => T)(read()) : update;
      cache = next;
      if (mode === "local") {
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Storage unavailable: keep the in-memory state for this session.
        }
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    mode: () => mode,
    setMode(next, initial) {
      if (next === mode && initial === undefined) return;
      mode = next;
      cache = next === "memory" ? (initial ?? empty) : undefined;
      emit();
    },
    readLocal,
    clearLocal() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Nothing stored, or storage blocked.
      }
      if (mode === "local") {
        cache = empty;
        emit();
      }
    },
  };
}

export function usePersistentStore<T>(store: PersistentStore<T>, empty: T): T {
  return useSyncExternalStore(store.subscribe, store.get, () => empty);
}
