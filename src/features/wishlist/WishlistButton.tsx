"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";
import { useWishlist } from "./store";

interface WishlistButtonProps {
  product: { id: number; slug: string; name: string; imageUrl: string | null };
  /** "overlay" sits on a card photo; "outline" is the product page button. */
  variant?: "overlay" | "outline";
  className?: string;
}

const useHydrated = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

/**
 * Save / unsave a product in the guest wishlist (this device). The same state
 * is shared by every card and the product page. A real <button> placed next
 * to — never inside — the card's link.
 */
export function WishlistButton({ product, variant = "overlay", className }: WishlistButtonProps) {
  const t = useTranslations("Wishlist");
  const { has, toggle } = useWishlist();
  const hydrated = useHydrated();
  const saved = hydrated && has(product.id);
  const label = saved ? t("remove", { name: product.name }) : t("save", { name: product.name });

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={() => toggle({ productId: product.id, slug: product.slug, name: product.name, imageUrl: product.imageUrl })}
      className={cn(
        "group/wish inline-flex items-center justify-center rounded-full transition-[background-color,color,transform] duration-(--duration-fast) active:scale-90",
        variant === "overlay"
          ? "size-11 bg-on-media/90 text-on-media-foreground shadow-card backdrop-blur hover:bg-on-media"
          : "h-14 w-14 shrink-0 border border-border-strong bg-surface text-foreground hover:border-brand hover:text-brand-text",
        saved && "text-brand-text",
        className,
      )}
    >
      <Heart className={cn("size-5 transition-transform group-hover/wish:scale-110", saved && "fill-current")} aria-hidden />
    </button>
  );
}
