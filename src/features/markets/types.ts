/** Cookie that remembers the visitor's market. Not a URL dimension (see docs/architecture.md). */
export const MARKET_COOKIE = "alo_market";

export interface MarketOption {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string | null;
}
