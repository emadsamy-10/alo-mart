import { Geist, Tajawal } from "next/font/google";

/**
 * Self-hosted at build time by next/font: no runtime requests to Google, and
 * size-adjusted fallbacks keep CLS near zero while the files load.
 */
export const latinFont = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin-face",
});

export const arabicFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-arabic-face",
});
