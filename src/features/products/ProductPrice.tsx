import { useLocale, useTranslations } from "next-intl";
import { formatMoney, formatMoneyParts, type MoneyPart } from "@/lib/i18n/format";
import { cn } from "@/lib/utils/cn";
import type { PriceView } from "./pricing";

interface ProductPriceProps {
  price: PriceView | null;
  size?: "sm" | "md" | "lg";
  /** Price color for dark bands. */
  tone?: "default" | "panel";
  className?: string;
}

const AMOUNT: Record<NonNullable<ProductPriceProps["size"]>, string> = {
  sm: "text-[1.0625rem]",
  md: "text-[1.1875rem] lg:text-xl",
  lg: "text-[2rem] tracking-display",
};

/** Bold number, smaller currency, in the locale's order. */
function Money({ parts, size }: { parts: MoneyPart[]; size: NonNullable<ProductPriceProps["size"]> }) {
  return (
    <>
      {parts.map((part, i) =>
        part.type === "currency" ? (
          <span key={i} className={cn("font-semibold", size === "lg" ? "text-base" : "text-[0.72em]")}>
            {part.value}
          </span>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

/**
 * Selling price in the market currency, in the brand red of the approved
 * design. A struck "was" price appears only for a real API-reported
 * reduction; ranges read "From X" on cards and "X – Y" on product pages.
 */
export function ProductPrice({ price, size = "sm", tone = "default", className }: ProductPriceProps) {
  const locale = useLocale();
  const t = useTranslations("Product");

  if (!price) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{t("priceUnavailable")}</p>;
  }

  const amount = formatMoneyParts(price.amount, price.currency, locale);
  const max = price.maxAmount ? formatMoney(price.maxAmount, price.currency, locale) : null;
  const regular = price.regularAmount ? formatMoney(price.regularAmount, price.currency, locale) : null;
  const priceColor = tone === "panel" ? "text-panel-foreground" : "text-brand-text";

  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {max && size !== "lg" ? <span className="text-xs font-medium text-muted-foreground">{t("fromLabel")}</span> : null}
      <p className={cn("leading-none font-extrabold whitespace-nowrap tabular-nums", AMOUNT[size], priceColor)}>
        {amount ? <Money parts={amount} size={size} /> : null}
        {max && size === "lg" ? <span className="font-bold"> – {max}</span> : null}
      </p>
      {regular ? (
        <p
          className={cn(
            "whitespace-nowrap tabular-nums",
            size === "lg" ? "text-base" : "text-[0.8125rem]",
            tone === "panel" ? "text-panel-muted" : "text-muted-foreground",
          )}
        >
          <span className="sr-only">{t("was", { price: regular })}</span>
          <s aria-hidden>{regular}</s>
        </p>
      ) : null}
    </div>
  );
}
