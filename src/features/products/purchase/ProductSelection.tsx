"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CartCurrency } from "@/features/cart/cart";
import type { GalleryImage } from "../gallery/types";
import { findVariant, initialSelection, selectValue, variantAxes, type Selection, type VariantAxis, type VariantLike } from "../variants";

/** Serializable product data the interactive islands need (no SEO content). */
export interface PurchasableProduct {
  id: number;
  slug: string;
  name: string;
  imageUrl: string | null;
  currency: CartCurrency;
  variants: (VariantLike & { gallery: GalleryImage[] })[];
  gallery: GalleryImage[];
}

interface SelectionContextValue {
  product: PurchasableProduct;
  axes: VariantAxis[];
  selection: Selection;
  choose: (axisId: number, valueId: number) => void;
  variant: (VariantLike & { gallery: GalleryImage[] }) | null;
  images: GalleryImage[];
}

const Ctx = createContext<SelectionContextValue | null>(null);

/**
 * Holds the shopper's option choices for one product page. Gallery and
 * purchase panel read it; everything else on the page stays server-rendered.
 */
export function ProductSelectionProvider({ product, children }: { product: PurchasableProduct; children: ReactNode }) {
  const axes = useMemo(() => variantAxes(product.variants), [product.variants]);
  const [selection, setSelection] = useState<Selection>(() => initialSelection(product.variants));

  const value = useMemo<SelectionContextValue>(() => {
    const variant = findVariant(product.variants, axes, selection) as SelectionContextValue["variant"];
    // A variant's own photos come first, then the product's shared ones.
    const own = variant?.gallery ?? [];
    const images = own.length ? [...own, ...product.gallery.filter((g) => !own.some((o) => o.id === g.id))] : product.gallery;
    return {
      product,
      axes,
      selection,
      variant,
      images,
      choose: (axisId, valueId) => setSelection((s) => selectValue(product.variants, axes, s, axisId, valueId)),
    };
  }, [product, axes, selection]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProductSelection(): SelectionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useProductSelection must be used inside <ProductSelectionProvider>");
  return v;
}
