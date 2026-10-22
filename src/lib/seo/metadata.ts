import type { Metadata } from "next";
import { defaultLocale, locales, ogLocale, type Locale } from "@/lib/i18n/routing";

/**
 * Centralized page-metadata builder. Pure (configuration is passed in) so it
 * is unit-testable; pages call it through `pageMetadata()` in ./site.ts.
 *
 * URL policy:
 *   - canonical = the locale-prefixed path on SITE_URL, without query strings
 *     (market is a cookie, never a URL dimension, so no currency duplicates);
 *   - hreflang alternates for every locale + x-default (default locale);
 *   - `noindex` when the deployment is not indexable (staging) or the page
 *     asks for it (empty/thin/faceted pages).
 */

export interface SeoConfig {
  siteUrl: string;
  indexable: boolean;
  siteName: string;
}

export interface PageSeoInput {
  locale: Locale;
  /** Locale-less path, e.g. "/" or "/products/foo". */
  path: string;
  title: string;
  description: string;
  /** Absolute image URL for Open Graph / Twitter. */
  image?: { url: string; width?: number | null; height?: number | null; alt?: string } | null;
  noindex?: boolean;
  /** Use the title as-is instead of the "%s | ALO MART" template. */
  absoluteTitle?: boolean;
  type?: "website" | "article";
  /** 1-based page of a paginated listing; pages > 1 self-canonicalize with ?page=N. */
  page?: number;
  /** Locales this page actually exists in (defaults to all). */
  availableLocales?: readonly Locale[];
}

export function normalizePath(path: string): string {
  const clean = `/${path.replace(/^\/+|\/+$/g, "")}`;
  return clean === "/" ? "" : clean;
}

export function localizedUrl(siteUrl: string, locale: string, path: string, page?: number): string {
  const query = page && page > 1 ? `?page=${Math.floor(page)}` : "";
  return `${siteUrl}/${locale}${normalizePath(path)}${query}`;
}

export function languageAlternates(siteUrl: string, path: string, available: readonly Locale[] = locales, page?: number) {
  const languages: Record<string, string> = {};
  for (const locale of available) languages[locale] = localizedUrl(siteUrl, locale, path, page);
  const xDefault = available.includes(defaultLocale) ? defaultLocale : available[0];
  if (xDefault) languages["x-default"] = localizedUrl(siteUrl, xDefault, path, page);
  return languages;
}

export function robotsFor(config: SeoConfig, noindex?: boolean): Metadata["robots"] {
  const index = config.indexable && !noindex;
  return {
    index,
    follow: config.indexable,
    googleBot: { index, follow: config.indexable, "max-image-preview": "large", "max-snippet": -1 },
  };
}

/** Collapse whitespace and cut at a word boundary — meta descriptions ~160 chars. */
export function truncateDescription(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:،-]+$/, "")}…`;
}

export function buildPageMetadata(config: SeoConfig, input: PageSeoInput): Metadata {
  const canonical = localizedUrl(config.siteUrl, input.locale, input.path, input.page);
  const description = truncateDescription(input.description);
  const images = input.image
    ? [
        {
          url: input.image.url,
          width: input.image.width ?? undefined,
          height: input.image.height ?? undefined,
          alt: input.image.alt ?? input.title,
        },
      ]
    : undefined;

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description,
    alternates: {
      canonical,
      languages: languageAlternates(config.siteUrl, input.path, input.availableLocales, input.page),
    },
    robots: robotsFor(config, input.noindex),
    openGraph: {
      type: input.type ?? "website",
      siteName: config.siteName,
      url: canonical,
      title: input.title,
      description,
      locale: ogLocale[input.locale],
      alternateLocale: locales.filter((l) => l !== input.locale).map((l) => ogLocale[l]),
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description,
      images: images?.map((i) => i.url),
    },
  };
}
