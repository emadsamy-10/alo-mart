"use server";

import { cookies } from "next/headers";
import { getMarkets } from "./api";
import { MARKET_COOKIE } from "./types";

/**
 * Persist the visitor's market. Only codes of currently active markets are
 * accepted, so a crafted value can never reach catalog requests.
 */
export async function setMarketAction(code: string): Promise<{ ok: boolean }> {
  const markets = await getMarkets("en");
  const normalized = code.trim().toUpperCase();
  if (!markets.ok || !markets.data.some((m) => m.code === normalized)) return { ok: false };

  const store = await cookies();
  store.set(MARKET_COOKIE, normalized, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true };
}
