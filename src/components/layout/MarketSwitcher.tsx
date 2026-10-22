"use client";

import { Check, ChevronDown, Globe2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "radix-ui";
import { useState, useTransition } from "react";
import { useRouter } from "@/lib/i18n/navigation";
import { setMarketAction } from "@/features/markets/actions";
import type { MarketOption } from "@/features/markets/types";
import { cn } from "@/lib/utils/cn";

interface MarketSwitcherProps {
  markets: MarketOption[];
  current: string;
  /** "pill" mobile header · "utility" desktop top bar · "button" empty states. */
  trigger?: "pill" | "utility" | "button";
  align?: "start" | "end" | "center";
}

/**
 * Market = where you shop (prices, currency, availability). It is stored in an
 * httpOnly cookie by a Server Action and the page is re-rendered on the
 * server, so all prices come from the API for the new market — nothing is
 * converted in the browser.
 */
export function MarketSwitcher({ markets, current, trigger = "pill", align = "end" }: MarketSwitcherProps) {
  const t = useTranslations("Preferences");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const active = markets.find((m) => m.code === current);

  if (markets.length === 0) return null;

  function choose(code: string) {
    if (code === current) {
      setOpen(false);
      return;
    }
    setFailed(false);
    startTransition(async () => {
      const result = await setMarketAction(code);
      if (!result.ok) {
        setFailed(true);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={
          trigger !== "button"
            ? active
              ? t("currentMarket", { name: active.name, currency: active.currencyCode })
              : t("market")
            : undefined
        }
        className={cn(
          trigger === "pill"
            ? "inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-surface ps-3 pe-2.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-border-strong data-[state=open]:border-border-strong"
            : trigger === "utility"
              ? "-ms-2.5 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-semibold text-foreground transition-colors hover:bg-surface data-[state=open]:bg-surface"
              : "inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-ink-foreground",
        )}
      >
        <Globe2 className="size-4 text-muted-foreground" aria-hidden />
        {trigger === "pill" ? (
          <span>{active?.code ?? current}</span>
        ) : trigger === "utility" ? (
          <>
            <span>{active?.name ?? current}</span>
            <span className="font-medium text-muted-foreground">{active?.currencyCode}</span>
          </>
        ) : (
          <span>{t("chooseMarket")}</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align={align}
          sideOffset={10}
          collisionPadding={16}
          className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-border bg-surface p-3 text-foreground shadow-popover"
        >
          <div className="px-2 pt-1 pb-3">
            <p className="text-base font-bold">{t("chooseMarket")}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("marketHint")}</p>
          </div>
          <ul className="space-y-1.5" aria-busy={pending}>
            {markets.map((market) => {
              const selected = market.code === current;
              return (
                <li key={market.code}>
                  <button
                    type="button"
                    disabled={pending}
                    aria-pressed={selected}
                    onClick={() => choose(market.code)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-start transition-colors",
                      selected
                        ? "border-brand bg-brand-soft/50"
                        : "border-transparent hover:border-border hover:bg-surface-muted",
                    )}
                  >
                    <span className="grid h-9 w-11 shrink-0 place-items-center rounded-lg bg-surface-muted text-xs font-bold tracking-wide">
                      {market.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{market.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {market.currencyCode}
                        {market.currencySymbol ? ` · ${market.currencySymbol}` : ""}
                      </span>
                    </span>
                    {selected ? (
                      <span className="grid size-6 place-items-center rounded-full bg-brand text-brand-foreground">
                        <Check className="size-3.5" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {failed ? (
            <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">
              {t("marketUpdateFailed")}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
