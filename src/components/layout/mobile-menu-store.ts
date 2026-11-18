"use client";

import { useSyncExternalStore } from "react";

/** The drawer is opened from the header and from the bottom navigation. */
let open = false;
const listeners = new Set<() => void>();

export function setMobileMenuOpen(next: boolean) {
  open = next;
  listeners.forEach((listener) => listener());
}

export function useMobileMenu(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
  return [value, setMobileMenuOpen];
}
