"use client";

import { ShoppingBag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { CartLineItem, CartSummary, useCartRefresh } from "./CartLines";
import { useCart, useCartDrawer } from "./store";

/** Slide-in mini cart (inline-end edge, mirrored in RTL). Mounted once in the layout. */
export function CartDrawer() {
  const t = useTranslations("Cart");
  const [open, setOpen] = useCartDrawer();
  const { lines, count } = useCart();

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-overlay backdrop-blur-[2px]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="sheet-end fixed inset-y-0 end-0 z-50 flex w-[min(28rem,100vw)] flex-col bg-background shadow-popover outline-none"
          data-testid="cart-drawer"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-lg font-bold">
              {t("title")} {count ? <span className="font-medium text-muted-foreground tabular-nums">({count})</span> : null}
            </Dialog.Title>
            <Dialog.Close aria-label={t("close")} className="grid size-11 place-items-center rounded-full bg-surface-muted">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          {open ? <DrawerBody lines={lines} onNavigate={() => setOpen(false)} /> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DrawerBody({ lines, onNavigate }: { lines: ReturnType<typeof useCart>["lines"]; onNavigate: () => void }) {
  const t = useTranslations("Cart");
  const refreshing = useCartRefresh();

  if (!lines.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <span className="grid size-16 place-items-center rounded-full bg-surface-muted" aria-hidden>
          <ShoppingBag className="size-7" />
        </span>
        <p className="mt-5 text-lg font-bold">{t("emptyTitle")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
        <Link href="/products" onClick={onNavigate} className={buttonClass({ variant: "primary" }, "mt-6")}>
          {t("browse")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-5" aria-busy={refreshing}>
        {lines.map((line) => (
          <CartLineItem key={line.variantId} line={line} onNavigate={onNavigate} compact />
        ))}
      </ul>
      <div className="space-y-4 border-t border-border px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <CartSummary />
        <Link href="/cart" onClick={onNavigate} className={buttonClass({ variant: "primary", size: "lg" }, "w-full")}>
          {t("viewCart")}
        </Link>
      </div>
    </>
  );
}
