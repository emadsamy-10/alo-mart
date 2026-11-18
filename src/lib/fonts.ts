import { Alexandria } from "next/font/google";

/**
 * One family for Arabic and Latin. Self-hosted at build time by next/font: no
 * runtime requests to Google, and a size-adjusted fallback keeps CLS near zero
 * while the files load. Variable weight (the `wght` axis, 100–900).
 */
export const siteFont = Alexandria({
  subsets: ["arabic", "latin"],
  display: "swap",
  variable: "--font-alexandria",
});
