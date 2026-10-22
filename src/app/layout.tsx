import type { ReactNode } from "react";
import "./globals.css";

/**
 * The real root layout is app/[locale]/layout.tsx (it owns <html lang dir>).
 * This pass-through exists so global files (not-found for non-locale paths)
 * have a parent.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
