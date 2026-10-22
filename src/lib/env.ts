import "server-only";

/**
 * Server-side runtime configuration. Everything is read here once so feature
 * code never touches process.env directly; nothing in this module reaches a
 * client bundle (`server-only`).
 */

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  apiBaseUrl: trimTrailingSlash(
    process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1",
  ),
  apiTimeoutMs: positiveInt(process.env.ALO_API_TIMEOUT_MS, 8000),
  siteUrl: trimTrailingSlash(process.env.SITE_URL ?? "http://localhost:3000"),
  /** Only an explicit "true" allows indexing — staging is safe by default. */
  indexable: process.env.SITE_INDEXABLE === "true",
  defaultMarket: (process.env.DEFAULT_MARKET ?? "EG").trim().toUpperCase(),
} as const;
