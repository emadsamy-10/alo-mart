/** Cookie that remembers the visitor's market. Not a URL dimension (see docs/architecture.md). */
export const MARKET_COOKIE = "alo_market";

export interface MarketOption {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string | null;
  /** Fraction digits of the market currency (EGP 2, KWD 3, JPY 0). */
  currencyDecimals: number;
}
