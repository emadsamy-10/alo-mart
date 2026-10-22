"use client";

import { Check, CheckCircle2, Info, Minus, Plus, ShoppingBag, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { setCartDrawerOpen, useCart } from "@/features/cart/store";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { formatMoney, formatPercent } from "@/lib/i18n/format";
import { cn } from "@/lib/utils/cn";
import { MAX_QUANTITY, clampQuantity, valueState, variantLabel, variantPrice } from "../variants";
import { useProductSelection } from "./ProductSelection";

/**
 * Options, live price/availability, quantity, Add to Cart and Save.
 * Everything comes from the API's variants; nothing is hardcoded.
 */
export function PurchasePanel() {
  const t = useTranslations("Purchase");
  const locale = useLocale();
  const { product, axes, selection, choose, variant } = useProductSelection();
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  // Feedback belongs to the variant it was given for; choosing another option clears it.
  const [feedback, setFeedback] = useState<{ variantId: number | null; kind: "added" | "incomplete" } | null>(null);
  const mainButton = useRef<HTMLButtonElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  // Mobile sticky bar appears once the main button has scrolled above the viewport.
  // The root extends far below the viewport so "below" counts as intersecting:
  // otherwise a jump from below to above (fast fling, restored scroll position)
  // never changes the intersection state and the callback never fires.
  useEffect(() => {
    const el = mainButton.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0), {
      rootMargin: "0px 0px 100000px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const status = feedback && feedback.variantId === (variant?.id ?? null) ? feedback.kind : "idle";

  const missing = axes.filter((a) => selection[a.id] === undefined);
  const price = variant ? variantPrice(variant) : null;
  const inStock = variant?.is_in_stock ?? false;
  const purchasable = !!variant && inStock && !!price?.amount;
  const discount =
    price?.regular && price.amount ? Math.floor(((Number(price.regular) - Number(price.amount)) * 100) / Number(price.regular)) : null;

  const add = () => {
    if (!variant || missing.length) {
      setFeedback({ variantId: variant?.id ?? null, kind: "incomplete" });
      return;
    }
    if (!purchasable || !price?.amount) return;
    cart.add({
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      variantLabel: variantLabel(variant, axes),
      imageUrl: variant.gallery[0]?.thumb ?? product.imageUrl,
      unitPrice: price.amount,
      regularPrice: price.regular,
      currency: product.currency,
      quantity,
    });
    setFeedback({ variantId: variant.id, kind: "added" });
    setCartDrawerOpen(true);
  };

  const amount = price?.amount ? formatMoney(price.amount, product.currency, locale) : null;
  const regular = price?.regular ? formatMoney(price.regular, product.currency, locale) : null;

  const addLabel = !variant && missing.length === 0 ? t("unavailable") : !inStock && variant ? t("outOfStock") : t("addToCart");

  return (
    <div className="space-y-6">
      {/* Price & availability for the selected variant */}
      <div className="rounded-card bg-surface p-5 shadow-card ring-1 ring-border/70 sm:p-6">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1" aria-live="polite">
          {amount ? (
            <p className="tracking-display text-[2rem] leading-none font-extrabold text-brand-text tabular-nums" data-testid="pdp-price">
              {amount}
            </p>
          ) : (
            <p className="text-base text-muted-foreground">{t("priceUnavailable")}</p>
          )}
          {regular ? (
            <p className="text-base text-muted-foreground tabular-nums">
              <span className="sr-only">{t("was", { price: regular })}</span>
              <s aria-hidden>{regular}</s>
            </p>
          ) : null}
          {discount ? (
            <span className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand-ink">{t("off", { percent: formatPercent(discount, locale) })}</span>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {variant ? (
            <p className={cn("flex items-center gap-1.5 font-semibold", inStock ? "text-success" : "text-muted-foreground")} data-testid="pdp-stock">
              {inStock ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
              {inStock ? t("inStock") : t("outOfStock")}
            </p>
          ) : null}
          {variant?.sku ? <p className="text-muted-foreground">{t("sku", { sku: variant.sku })}</p> : null}
        </div>
      </div>

      {/* Option selectors */}
      {axes.map((axis) => {
        const chosen = axis.values.find((v) => v.id === selection[axis.id]);
        return (
          <fieldset key={axis.id} className="space-y-3">
            <legend className="text-sm font-bold">
              {axis.name}
              {chosen ? <span className="ms-2 font-medium text-muted-foreground">{chosen.name}</span> : null}
            </legend>
            <div role="radiogroup" aria-label={axis.name} className="flex flex-wrap gap-2.5">
              {axis.values.map((value) => {
                const state = valueState(product.variants, axes, selection, axis.id, value.id);
                const selected = selection[axis.id] === value.id;
                const disabled = state === "unavailable";
                const label = state === "out_of_stock" ? t("optionOutOfStock", { name: value.name }) : value.name;
                return axis.kind === "swatch" ? (
                  <button
                    key={value.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    title={label}
                    disabled={disabled}
                    onClick={() => choose(axis.id, value.id)}
                    className={cn(
                      "relative grid size-12 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-background transition disabled:cursor-not-allowed disabled:opacity-30",
                      selected ? "ring-ink" : "ring-border hover:ring-border-strong",
                    )}
                  >
                    <span className="size-9 rounded-full border border-black/20 shadow-inner" style={{ backgroundColor: value.swatch ?? undefined }} />
                    {selected ? <Check className="absolute size-4 text-white mix-blend-difference" aria-hidden /> : null}
                    {state === "out_of_stock" ? <span className="absolute h-0.5 w-11 rotate-45 rounded bg-muted-foreground" aria-hidden /> : null}
                  </button>
                ) : (
                  <button
                    key={value.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    disabled={disabled}
                    onClick={() => choose(axis.id, value.id)}
                    className={cn(
                      "inline-flex min-h-12 min-w-14 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-35",
                      selected ? "border-ink bg-ink text-ink-foreground" : "border-border-strong bg-surface hover:border-ink",
                      state === "out_of_stock" && !selected && "text-muted-foreground line-through",
                    )}
                  >
                    {value.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {status === "incomplete" && missing.length ? (
        <p role="alert" className="rounded-xl bg-warning-soft px-4 py-3 text-sm font-medium text-warning">
          {t("chooseOption", { name: missing[0].name })}
        </p>
      ) : null}

      {/* Quantity + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-14 items-center rounded-full border border-border-strong bg-surface" role="group" aria-label={t("quantity")}>
          <button
            type="button"
            onClick={() => setQuantity((q) => clampQuantity(q - 1))}
            disabled={quantity <= 1}
            aria-label={t("decrease")}
            className="grid size-12 place-items-center rounded-full transition hover:bg-surface-muted disabled:opacity-35"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_QUANTITY}
            value={quantity}
            onChange={(e) => setQuantity(clampQuantity(Number(e.target.value)))}
            aria-label={t("quantity")}
            data-testid="pdp-quantity"
            className="w-12 [appearance:textfield] bg-transparent text-center text-base font-bold tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => clampQuantity(q + 1))}
            disabled={quantity >= MAX_QUANTITY}
            aria-label={t("increase")}
            className="grid size-12 place-items-center rounded-full transition hover:bg-surface-muted disabled:opacity-35"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>

        <button
          ref={mainButton}
          type="button"
          onClick={add}
          disabled={!!variant && !purchasable}
          data-testid="add-to-cart"
          className="inline-flex h-14 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-full bg-brand px-6 text-base font-bold text-brand-foreground shadow-[0_12px_28px_-14px_var(--brand)] transition-[background-color,transform] hover:bg-brand-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-muted-foreground/40 disabled:shadow-none"
        >
          {status === "added" ? <Check className="size-5" aria-hidden /> : <ShoppingBag className="size-5" aria-hidden />}
          {status === "added" ? t("added") : addLabel}
        </button>

        <WishlistButton product={{ id: product.id, slug: product.slug, name: product.name, imageUrl: product.imageUrl }} variant="outline" />
      </div>

      <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("localCartNote")}
      </p>

      {/* Mobile sticky purchase bar */}
      <div
        data-testid="sticky-purchase-bar"
        aria-hidden={!showSticky}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised backdrop-blur transition-transform duration-(--duration-base) lg:hidden",
          showSticky ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{product.name}</p>
            {amount ? <p className="text-base font-extrabold text-brand-text tabular-nums">{amount}</p> : null}
          </div>
          <button
            type="button"
            tabIndex={showSticky ? 0 : -1}
            onClick={add}
            disabled={!!variant && !purchasable}
            className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-brand-foreground disabled:bg-muted-foreground/40"
          >
            <ShoppingBag className="size-4" aria-hidden />
            {status === "added" ? t("added") : addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
