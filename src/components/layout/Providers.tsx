"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

/** Class-based theming; the blocking script next-themes injects prevents a theme flash. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="alo-theme">
      {children}
    </ThemeProvider>
  );
}
