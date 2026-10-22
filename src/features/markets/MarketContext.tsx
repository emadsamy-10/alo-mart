"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The market resolved on the server for this request (from the httpOnly
 * cookie), exposed to client islands that store market-specific data
 * (the cart). Changing market re-renders the layout, so this always matches
 * the prices on the page.
 */
const MarketContext = createContext<string | null>(null);

export function MarketProvider({ market, children }: { market: string; children: ReactNode }) {
  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>;
}

export function useMarket(): string {
  const market = useContext(MarketContext);
  if (!market) throw new Error("useMarket must be used inside <MarketProvider>");
  return market;
}
