"use client";

import { useLocale, useTranslations } from "next-intl";
import { Slider } from "radix-ui";
import { useId, useState, type FormEvent } from "react";
import { formatMoney } from "@/lib/i18n/format";
import { localeDirection } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils/cn";
import { useCatalog } from "./CatalogNavigation";
import { compareMoney, normalizeMoney, withPatch } from "./filters";

export interface PriceBounds {
  min: string | null;
  max: string | null;
}

interface PriceRangeFilterProps {
  /** Facet bounds: the available prices under every OTHER filter (the API ignores the selected range). */
  bounds: PriceBounds;
  currency: { code: string; decimal_places: number };
  /** Short currency label shown inside the boxes ("EGP", "ج.م"). */
  currencyLabel: string;
}

/** A 1-2-5 step giving ~150 positions across the range, never finer than the currency allows. */
export function sliderStep(span: number, decimals: number): number {
  const finest = 10 ** -Math.min(decimals, 2);
  if (!(span > 0)) return 1;
  const raw = span / 150;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= raw) ?? raw;
  return Math.max(finest, nice);
}

/** The slider's track: the facet bounds, widened to contain the shopper's own selection. */
export function sliderDomain(bounds: PriceBounds, selected: PriceBounds): { lo: number; hi: number } | null {
  const values = [bounds.min, bounds.max, selected.min, selected.max].filter((v): v is string => v !== null).map(Number);
  if (bounds.min === null || bounds.max === null || values.some((v) => !Number.isFinite(v))) return null;
  const lo = Math.floor(Math.min(...values));
  const hi = Math.ceil(Math.max(...values));
  return hi > lo ? { lo, hi } : null;
}

/** "12500.5" → "12,500.5" for reading; typing uses the raw value (normalizeMoney accepts both). */
export function groupDigits(value: string): string {
  const normalized = normalizeMoney(value);
  if (normalized === null) return value;
  const [int, frac] = normalized.split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac ? `.${frac}` : "");
}

function plain(value: number, decimals: number): string {
  return normalizeMoney(value.toFixed(Math.min(decimals, 4))) ?? "0";
}

/**
 * Price range (selling price, market currency). The boxes accept exact
 * decimals (Enter or Apply); the slider applies on release. A thumb left at
 * the end of the track means "no bound", so rounding the track to whole
 * units never excludes a product priced at the very edge.
 */
export function PriceRangeFilter({ bounds, currency, currencyLabel }: PriceRangeFilterProps) {
  const t = useTranslations("Catalog");
  const locale = useLocale();
  const { state, navigate } = useCatalog();
  const errorId = useId();
  const minId = useId();
  const maxId = useId();

  const domain = sliderDomain(bounds, { min: state.min, max: state.max });
  const step = domain ? sliderStep(domain.hi - domain.lo, currency.decimal_places) : 1;

  // The boxes show grouped digits ("12,500"); the value is never rewritten while the
  // shopper is typing or selecting — only after the slider moves or the box loses focus.
  const [minText, setMinText] = useState(groupDigits(state.min ?? ""));
  const [maxText, setMaxText] = useState(groupDigits(state.max ?? ""));
  const [error, setError] = useState<string | null>(null);
  // URL changed (Back/Forward, chip removed, reset): show the committed values.
  const committed = `${state.min ?? ""}|${state.max ?? ""}`;
  const [synced, setSynced] = useState(committed);
  if (synced !== committed) {
    setSynced(committed);
    setMinText(groupDigits(state.min ?? ""));
    setMaxText(groupDigits(state.max ?? ""));
    setError(null);
  }

  const apply = (min: string | null, max: string | null) => {
    if (min !== null && max !== null && compareMoney(min, max) > 0) {
      setError(t("priceOrder"));
      return;
    }
    setError(null);
    if (min === state.min && max === state.max) return;
    navigate(withPatch(state, { min, max }));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const min = minText.trim() === "" ? null : normalizeMoney(minText);
    const max = maxText.trim() === "" ? null : normalizeMoney(maxText);
    if ((minText.trim() !== "" && min === null) || (maxText.trim() !== "" && max === null)) {
      setError(t("priceInvalid"));
      return;
    }
    apply(min, max);
  };

  const sliderValue = domain
    ? [
        Math.min(domain.hi, Math.max(domain.lo, Number(normalizeMoney(minText) ?? domain.lo))),
        Math.min(domain.hi, Math.max(domain.lo, Number(normalizeMoney(maxText) ?? domain.hi))),
      ]
    : null;

  const money = (v: number | string) => formatMoney(v, currency, locale) ?? String(v);
  const box =
    "relative flex h-16 flex-col justify-center rounded-2xl border bg-surface px-3.5 transition-colors focus-within:border-brand has-[input[aria-invalid=true]]:border-danger";

  return (
    <form onSubmit={submit} noValidate data-testid="price-filter" className="space-y-4 px-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        <div className={cn(box, "border-border")}>
          <label htmlFor={minId} className="text-[0.6875rem] font-semibold text-muted-foreground">
            {t("priceFrom")}
          </label>
          <div className="flex items-baseline gap-1">
            <input
              id={minId}
              name="min"
              inputMode="decimal"
              autoComplete="off"
              value={minText}
              placeholder={bounds.min !== null ? groupDigits(plain(Math.floor(Number(bounds.min)), currency.decimal_places)) : "0"}
              onBlur={() => setMinText((v) => groupDigits(v))}
              onChange={(e) => setMinText(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums outline-none placeholder:font-medium placeholder:text-muted-foreground/70"
            />
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{currencyLabel}</span>
          </div>
        </div>
        <div className={cn(box, "border-border")}>
          <label htmlFor={maxId} className="text-[0.6875rem] font-semibold text-muted-foreground">
            {t("priceTo")}
          </label>
          <div className="flex items-baseline gap-1">
            <input
              id={maxId}
              name="max"
              inputMode="decimal"
              autoComplete="off"
              value={maxText}
              placeholder={bounds.max !== null ? groupDigits(plain(Math.ceil(Number(bounds.max)), currency.decimal_places)) : ""}
              onBlur={() => setMaxText((v) => groupDigits(v))}
              onChange={(e) => setMaxText(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className="w-full min-w-0 bg-transparent text-sm font-bold tabular-nums outline-none placeholder:font-medium placeholder:text-muted-foreground/70"
            />
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{currencyLabel}</span>
          </div>
        </div>
      </div>

      {domain && sliderValue ? (
        <div className="px-1 pt-1">
          <Slider.Root
            dir={localeDirection(locale)}
            min={domain.lo}
            max={domain.hi}
            step={step}
            minStepsBetweenThumbs={0}
            value={sliderValue}
            onValueChange={([a, b]) => {
              setError(null);
              setMinText(a <= domain.lo ? "" : groupDigits(plain(a, currency.decimal_places)));
              setMaxText(b >= domain.hi ? "" : groupDigits(plain(b, currency.decimal_places)));
            }}
            onValueCommit={([a, b]) =>
              apply(a <= domain.lo ? null : plain(a, currency.decimal_places), b >= domain.hi ? null : plain(b, currency.decimal_places))
            }
            className="relative flex h-6 w-full touch-none items-center select-none"
            data-testid="price-slider"
          >
            <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-muted">
              <Slider.Range className="absolute h-full rounded-full bg-brand" />
            </Slider.Track>
            {[t("priceMinThumb"), t("priceMaxThumb")].map((label, i) => (
              <Slider.Thumb
                key={label}
                aria-label={label}
                aria-valuetext={money(sliderValue[i])}
                className="block size-6 rounded-full border-2 border-brand bg-surface shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-4 focus-visible:ring-(--focus-ring)/30"
              />
            ))}
          </Slider.Root>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
            <span>{money(domain.lo)}</span>
            <span>{money(domain.hi)}</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-brand px-4 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand-ink"
        >
          {t("priceApply")}
        </button>
        {state.min !== null || state.max !== null ? (
          <button
            type="button"
            onClick={() => apply(null, null)}
            className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            {t("priceReset")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
