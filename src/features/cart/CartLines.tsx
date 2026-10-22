"use client";

import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useTransition } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { MAX_QUANTITY } from "@/features/products/variants";
import { refreshCartLines } from "./actions";
import type { CartLine } from "./cart";
import { useCart } from "./store";

/**
 * Re-reads current prices/availability once per mount when lines exist, so a
 * cart opened days later shows today's prices and flags stale lines.
 */
export function useCartRefresh() {
  const cart = useCart();
  const [pending, startTransition] = useTransition();
  const done = useRef<string | null>(null);
  const key = `${cart.market}:${cart.lines.map((l) => l.variantId).join(",")}`;

  useEffect(() => {
    if (!cart.lines.length || done.current === key) return;
    done.current = key;
    startTransition(async () => {
      try {
        cart.refresh(await refreshCartLines(cart.lines.map((l) => ({ slug: l.slug, variantId: l.variantId }))));
      } catch {
        // Network failure: keep the snapshot; it is refreshed next time.
      }
    });
  }, [key, cart]);

  return pending;
}

export function CartLineItem({ line, onNavigate, compact = false }: { line: CartLine; onNavigate?: () => void; compact?: boolean }) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { update, remove } = useCart();
  const price = formatMoney(line.unitPrice, line.currency, locale);
  const scale = 10 ** line.currency.decimal_places;
  const total = formatMoney(((Math.round(Number(line.unitPrice) * scale) * line.quantity) / scale).toFixed(line.currency.decimal_places), line.currency, locale);
  const regular = line.regularPrice ? formatMoney(line.regularPrice, line.currency, locale) : null;

  return (
    <li className={cn("flex gap-4 py-4", line.issue && "opacity-80")} data-testid="cart-line">
      <Link href={`/products/${line.slug}`} onClick={onNavigate} className="block w-20 shrink-0 overflow-hidden rounded-well bg-image-well sm:w-24" tabIndex={-1} aria-hidden>
        <AppImage src={line.imageUrl} alt="" ratio="1/1" sizes="96px" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/products/${line.slug}`} onClick={onNavigate} className="line-clamp-2 text-sm font-semibold hover:text-brand-text sm:text-[0.9375rem]">
              {line.name}
            </Link>
            {line.variantLabel ? <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{line.variantLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => remove(line.variantId)}
            aria-label={t("remove", { name: line.name })}
            className="-me-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        {line.issue ? (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-danger">
            <AlertTriangle className="size-3.5" aria-hidden />
            {line.issue === "out_of_stock" ? t("lineOutOfStock") : t("lineUnavailable")}
          </p>
        ) : null}

        <div className={cn("mt-3 flex flex-wrap items-center justify-between gap-3", compact && "mt-2")}>
          <div className="flex h-10 items-center rounded-full border border-border-strong" role="group" aria-label={t("quantityFor", { name: line.name })}>
            <button
              type="button"
              onClick={() => update(line.variantId, line.quantity - 1)}
              disabled={line.quantity <= 1 || !!line.issue}
              aria-label={t("decrease")}
              className="grid size-10 place-items-center rounded-full hover:bg-surface-muted disabled:opacity-35"
            >
              <Minus className="size-3.5" aria-hidden />
            </button>
            <span className="w-8 text-center text-sm font-bold tabular-nums" aria-live="polite" data-testid="cart-line-qty">
              {line.quantity}
            </span>
            <button
              type="button"
              onClick={() => update(line.variantId, line.quantity + 1)}
              disabled={line.quantity >= MAX_QUANTITY || !!line.issue}
              aria-label={t("increase")}
              className="grid size-10 place-items-center rounded-full hover:bg-surface-muted disabled:opacity-35"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          </div>
          <div className="text-end">
            <p className="text-base font-extrabold tabular-nums">{line.issue ? price : total}</p>
            {line.quantity > 1 && !line.issue ? <p className="text-xs text-muted-foreground tabular-nums">{t("each", { price: price ?? "" })}</p> : null}
            {regular && !line.issue ? <s className="text-xs text-muted-foreground tabular-nums">{regular}</s> : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export function CartSummary({ className }: { className?: string }) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { subtotal: sub, count } = useCart();
  if (!sub) return null;
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-base font-bold">{t("subtotal", { count })}</p>
        <p className="text-xl font-extrabold text-brand-text tabular-nums" data-testid="cart-subtotal">
          {formatMoney(sub.amount, sub.currency, locale)}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("checkoutNote")}</p>
    </div>
  );
}
