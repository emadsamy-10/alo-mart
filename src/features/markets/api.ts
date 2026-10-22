import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { z } from "zod";
import { apiGet } from "@/lib/api/client";
import { lenientArray } from "@/lib/api/schemas";
import { env } from "@/lib/env";
import { intlLocale } from "@/lib/i18n/routing";
import { MARKET_COOKIE, type MarketOption } from "./types";

const marketSchema = z.object({
  code: z.string(),
  name: z.string(),
  is_default: z.boolean().default(false),
  sort_order: z.number().default(0),
  country: z.object({ code: z.string(), name: z.string() }).nullable().optional(),
  currency: z.object({
    code: z.string(),
    symbol: z.string().nullable().optional(),
    decimal_places: z.number().default(2),
  }),
});

/**
 * Market codes are ISO 3166 regions; the API returns English names only, so
 * localize the country name with Intl (no invented data). Falls back to the API name.
 */
function regionName(code: string, locale: string): string | null {
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "region" }).of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/** Active markets (the API only lists effectively active ones). Changes rarely. */
export const getMarkets = cache(async (locale: string) => {
  const result = await apiGet("markets", lenientArray(marketSchema), {
    locale,
    revalidate: 600,
    tags: ["markets"],
  });
  if (!result.ok) return result;

  const markets: MarketOption[] = [...result.data]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      code: m.code.toUpperCase(),
      name: regionName(m.code, locale) ?? m.name,
      currencyCode: m.currency.code,
      currencySymbol: m.currency.symbol ?? null,
    }));
  return { ok: true as const, data: markets };
});

/**
 * Decide which market applies to this request:
 *   1. the visitor's saved choice, if that market is still active;
 *   2. otherwise DEFAULT_MARKET (what crawlers always get).
 * If the market list itself is unavailable we still return the configured
 * default so catalog reads can proceed — the API validates the code anyway.
 */
export const resolveMarket = cache(async (locale: string) => {
  const [store, markets] = await Promise.all([cookies(), getMarkets(locale)]);
  const saved = store.get(MARKET_COOKIE)?.value?.toUpperCase();
  const available = markets.ok ? markets.data : [];

  const pick = (code: string | undefined) => (code ? available.find((m) => m.code === code) : undefined);
  const current = pick(saved) ?? pick(env.defaultMarket) ?? available[0];

  return {
    code: current?.code ?? env.defaultMarket,
    current: current ?? null,
    markets: available,
    isDefault: (current?.code ?? env.defaultMarket) === env.defaultMarket,
  };
});
