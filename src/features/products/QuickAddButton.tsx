"use client";

import { Loader2, ShoppingCart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import type { CartCurrency } from "@/features/cart/cart";
import { setCartDrawerOpen, useCart } from "@/features/cart/store";
import { useMarket } from "@/features/markets/MarketContext";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { quickAddOption } from "./quick-add-action";

interface QuickAddButtonProps {
  product: { id: number; slug: string; name: string; imageUrl: string | null; currency: CartCurrency };
  /** Where to choose options; keeps a filtered listing's matched variant preselected. */
  href: string;
  className?: string;
}

/**
 * The card's cart button. A card never knows a product's variants, so the live
 * product decides: the only purchasable variant goes straight into the cart;
 * anything needing a choice opens the product page instead.
 */
export function QuickAddButton({ product, href, className }: QuickAddButtonProps) {
  const t = useTranslations("Purchase");
  const locale = useLocale();
  const market = useMarket();
  const router = useRouter();
  const cart = useCart();
  const [pending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const option = await quickAddOption(locale, market, product.slug).catch(() => ({ kind: "choose" as const }));
      if (option.kind === "choose") {
        router.push(href);
        return;
      }
      cart.add({
        variantId: option.variantId,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantLabel: option.variantLabel,
        imageUrl: product.imageUrl,
        unitPrice: option.unitPrice,
        regularPrice: option.regularPrice,
        currency: product.currency,
        quantity: 1,
      });
      setCartDrawerOpen(true);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-busy={pending || undefined}
      aria-label={t("quickAdd", { name: product.name })}
      title={t("quickAdd", { name: product.name })}
      data-testid="quick-add"
      className={cn(
        "relative z-10 grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground shadow-[0_8px_16px_-10px_var(--brand)] transition-[background-color,transform] duration-(--duration-fast) hover:bg-brand-ink active:scale-95 disabled:opacity-70 dark:hover:bg-brand/90",
        className,
      )}
    >
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ShoppingCart className="size-5" aria-hidden />}
    </button>
  );
}
