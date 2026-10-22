"use client";

import { ProductGallery } from "../gallery/ProductGallery";
import { useProductSelection } from "./ProductSelection";

/** The gallery for the currently selected variant (its own photos first). */
export function SelectedGallery() {
  const { images, product } = useProductSelection();
  // A new image set (another variant) starts fresh at its first image.
  return <ProductGallery key={images.map((i) => i.id).join(",")} images={images} productName={product.name} />;
}
