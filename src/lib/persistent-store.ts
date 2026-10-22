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
 */
export interface PersistentStore<T> {
  get(): T;
  set(update: T | ((current: T) => T)): void;
  subscribe(listener: () => void): () => void;
}

export function createPersistentStore<T>(key: string, empty: T, parse: (raw: unknown) => T): PersistentStore<T> {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache !== undefined) return cache;
    if (typeof window === "undefined") return empty;
    try {
      const raw = window.localStorage.getItem(key);
      cache = raw ? parse(JSON.parse(raw)) : empty;
    } catch {
      cache = empty;
    }
    return cache;
  };

  const emit = () => listeners.forEach((l) => l());

  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      cache = undefined;
      emit();
    });
  }

  return {
    get: read,
    set(update) {
      const next = typeof update === "function" ? (update as (c: T) => T)(read()) : update;
      cache = next;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Storage unavailable: keep the in-memory state for this session.
      }
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function usePersistentStore<T>(store: PersistentStore<T>, empty: T): T {
  return useSyncExternalStore(store.subscribe, store.get, () => empty);
}
