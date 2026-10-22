import { parseAmount } from "@/lib/i18n/format";
import type { Currency } from "@/lib/api/schemas";

/**
 * View model for every price display. Built only from API facts:
 *   - `price_from` / `price_to` are SELLING prices (sale applied) per market;
 *   - a deal exists only when the API says so (`deal` on deal cards, or a
 *     variant whose sale_price < price on the detail endpoint).
 */
export interface PriceView {
  currency: Currency;
  /** The amount the customer pays (lowest selling price when ranged). */
  amount: string;
  /** Present only for a price range. */
  maxAmount: string | null;
  /** Real previous price, only when a real reduction exists. */
  regularAmount: string | null;
  discountPercent: number | null;
}

interface PricedCard {
  currency: Currency;
  price_from: string | null;
  price_to: string | null;
  has_price_range: boolean;
  deal?: { regular_price: string; sale_price: string; discount_percent?: number | null } | null;
}

export function priceViewFromCard(card: PricedCard): PriceView | null {
  const from = parseAmount(card.price_from);
  if (from === null || card.price_from === null) return null;

  const to = parseAmount(card.price_to);
  const ranged = card.has_price_range && to !== null && to > from;

  const deal = card.deal;
  const regular = parseAmount(deal?.regular_price);
  const sale = parseAmount(deal?.sale_price);
  const realDeal = deal && regular !== null && sale !== null && sale < regular;

  return {
    currency: card.currency,
    amount: realDeal ? deal.sale_price : card.price_from,
    maxAmount: ranged && !realDeal ? card.price_to : null,
    regularAmount: realDeal ? deal.regular_price : null,
    discountPercent: realDeal ? (deal.discount_percent ?? computePercent(regular, sale)) : null,
  };
}

interface PricedVariant {
  price: string | null;
  sale_price: string | null;
}

/**
 * Detail endpoint: mirror the backend's deal rule (best real reduction across
 * variants) — but only for single-price products, so a "was" price never
 * sits next to a range it does not belong to.
 */
export function priceViewFromDetail(detail: PricedCard & { variants: PricedVariant[] }): PriceView | null {
  const base = priceViewFromCard({ ...detail, deal: null });
  if (!base || base.maxAmount) return base;

  let best: { price: string; sale: string; saleN: number; priceN: number } | null = null;
  for (const v of detail.variants) {
    const priceN = parseAmount(v.price);
    const saleN = parseAmount(v.sale_price);
    if (priceN === null || saleN === null || saleN >= priceN || !v.price || !v.sale_price) continue;
    if (!best || saleN < best.saleN) best = { price: v.price, sale: v.sale_price, saleN, priceN };
  }
  if (!best || parseAmount(base.amount) !== best.saleN) return base;

  return { ...base, regularAmount: best.price, discountPercent: computePercent(best.priceN, best.saleN) };
}

function computePercent(regular: number, sale: number): number {
  return regular > 0 ? Math.floor(((regular - sale) * 100) / regular) : 0;
}
