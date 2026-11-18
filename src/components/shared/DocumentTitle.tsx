"use client";

import { useEffect } from "react";

/**
 * Keeps a server-rendered title after hydration on pages where Next re-applies the layout's
 * metadata on the client (the localized not-found page).
 */
export function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
