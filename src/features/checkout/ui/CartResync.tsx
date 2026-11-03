"use client";

import { useEffect } from "react";
import { loadAccountCart } from "@/features/account/shop-actions";
import { applyAccountCart } from "@/features/cart/store";
import { useMarket } from "@/features/markets/MarketContext";

/**
 * After an order is placed the API empties the account cart; reload it so
 * the header count and drawer agree with the server right away.
 */
export function CartResync() {
  const market = useMarket();
  useEffect(() => {
    let cancelled = false;
    loadAccountCart(market).then((result) => {
      if (!cancelled && result.ok) applyAccountCart(market, result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [market]);
  return null;
}
