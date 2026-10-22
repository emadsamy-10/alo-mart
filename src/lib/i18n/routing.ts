import { defineRouting } from "next-intl/routing";

/**
 * Locale registry. Adding a locale = add it here + add messages/<locale>.json
 * (+ its direction below). Catalog names come from the API, which today only
 * stores English and Arabic — a new UI locale does NOT translate products.
 */
export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ar";

const rtlLocales: ReadonlySet<string> = new Set(["ar"]);

export function localeDirection(locale: string): "rtl" | "ltr" {
  return rtlLocales.has(locale) ? "rtl" : "ltr";
}

/** BCP-47 tag for Intl formatting: Arabic keeps Latin digits, as in the design references. */
export function intlLocale(locale: string): string {
  return locale === "ar" ? "ar-EG-u-nu-latn" : "en-US";
}

/** Open Graph locale codes. */
export const ogLocale: Record<Locale, string> = { ar: "ar_EG", en: "en_US" };

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
  // hreflang alternates are emitted in <head> by our metadata helpers instead.
  alternateLinks: false,
});

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
