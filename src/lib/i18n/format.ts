import { intlLocale } from "./routing";

export interface MoneyCurrency {
  code: string;
  decimal_places: number;
}

/**
 * Parse an API decimal string ("4350.0000"). Returns null for anything that is
 * not a finite, non-negative amount — never a fabricated 0.
 */
export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const amount = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/**
 * Locale-aware money: the market's own currency (no conversion), fraction
 * digits only when the amount actually has a fraction, Latin digits in Arabic.
 * e.g. en → "EGP 4,350", ar → "4,350 ج.م.‏"
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency: MoneyCurrency,
  locale: string,
): string | null {
  const amount = parseAmount(value);
  if (amount === null) return null;

  const places = Math.max(0, Math.min(4, currency.decimal_places));
  const hasFraction = Math.round(amount * 10 ** places) % 10 ** places !== 0;

  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency: currency.code,
      currencyDisplay: locale === "ar" ? "symbol" : "code",
      minimumFractionDigits: hasFraction ? places : 0,
      maximumFractionDigits: places,
    }).format(amount);
  } catch {
    // Unknown ISO code: still show a correct number with the raw code.
    const number = new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: hasFraction ? places : 0,
      maximumFractionDigits: places,
    }).format(amount);
    return `${number} ${currency.code}`;
  }
}

export interface MoneyPart {
  type: "amount" | "currency" | "literal";
  value: string;
}

/**
 * Same formatting as formatMoney, split so the UI can set the currency
 * smaller than the number (approved card design). Order follows the locale.
 */
export function formatMoneyParts(
  value: string | number | null | undefined,
  currency: MoneyCurrency,
  locale: string,
): MoneyPart[] | null {
  const amount = parseAmount(value);
  if (amount === null) return null;
  const places = Math.max(0, Math.min(4, currency.decimal_places));
  const hasFraction = Math.round(amount * 10 ** places) % 10 ** places !== 0;
  try {
    const parts = new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency: currency.code,
      currencyDisplay: locale === "ar" ? "symbol" : "code",
      minimumFractionDigits: hasFraction ? places : 0,
      maximumFractionDigits: places,
    }).formatToParts(amount);
    const out: MoneyPart[] = [];
    for (const part of parts) {
      const type: MoneyPart["type"] =
        part.type === "currency" ? "currency" : part.type === "literal" ? "literal" : "amount";
      const last = out.at(-1);
      if (last && last.type === type) last.value += part.value;
      else out.push({ type, value: part.value });
    }
    return out;
  } catch {
    const text = formatMoney(value, currency, locale);
    return text ? [{ type: "amount", value: text }] : null;
  }
}

export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 }).format(
    value / 100,
  );
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(value);
}

/** Currency as words for running text: ISO code in English ("EGP"), localized name otherwise ("جنيه مصري"). */
export function currencyName(code: string, locale: string): string {
  if (locale === "en") return code;
  try {
    return new Intl.DisplayNames([intlLocale(locale)], { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}
