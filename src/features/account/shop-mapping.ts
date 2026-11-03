import type { CartLine } from "@/features/cart/cart";
import type { WishlistEntry } from "@/features/wishlist/wishlist";
import type { AccountCart, AccountWishlist } from "./schemas";

/**
 * Account cart/wishlist responses → the SAME line/entry shapes the guest
 * stores use, so every cart and wishlist component renders both without
 * knowing which one it is looking at (pure, unit-tested).
 */

export interface AccountCartView {
  lines: CartLine[];
  /** variant id → account cart item id (needed to update/remove a line). */
  itemIds: Record<number, number>;
}

function optionLabel(options: AccountCart["items"][number]["variant"] extends infer V ? (V extends { options: infer O } ? O : never) : never): string {
  return options
    .map((o) => o.value?.name || "")
    .filter(Boolean)
    .join(" / ");
}

export function cartFromAccount(cart: AccountCart, imageFor: (url: string | null) => string | null): AccountCartView {
  const lines: CartLine[] = [];
  const itemIds: Record<number, number> = {};
  if (!cart.currency) return { lines, itemIds };

  for (const item of cart.items) {
    // A hard-deleted product/variant leaves nothing to show or link to.
    if (!item.product || !item.variant) continue;
    const unit = item.unit_price ?? item.price;
    const reduced = item.sale_price !== null && item.price !== null && unit !== null && Number(item.price) > Number(unit);
    const reason = item.unavailable_reason;
    lines.push({
      variantId: item.variant.id,
      productId: item.product.id,
      slug: item.product.slug,
      name: item.product.name,
      variantLabel: optionLabel(item.variant.options),
      imageUrl: imageFor(item.product.primary_image_url),
      unitPrice: unit ?? "0",
      regularPrice: reduced ? item.price : null,
      currency: cart.currency,
      quantity: item.quantity,
      issue: item.is_available ? null : reason === "out_of_stock" || reason === "insufficient_stock" ? "out_of_stock" : "unavailable",
      addedAt: item.id,
    });
    itemIds[item.variant.id] = item.id;
  }
  return { lines, itemIds };
}

export function wishlistFromAccount(wishlist: AccountWishlist, imageFor: (url: string | null) => string | null): WishlistEntry[] {
  return wishlist.items.flatMap((item) =>
    item.product
      ? [{ productId: item.product.id, slug: item.product.slug, name: item.product.name, imageUrl: imageFor(item.product.primary_image_url), addedAt: item.id }]
      : [],
  );
}
