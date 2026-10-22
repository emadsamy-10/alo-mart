import type { ProductCard as ProductCardData } from "@/lib/api/schemas";
import { ProductCard } from "./ProductCard";

/** Listing grid: 2 → 3 → 4 → 5 columns. The first row may hold the LCP image. */
export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            priority={index < 2}
            sizes="(min-width: 1280px) 17vw, (min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw"
          />
        </li>
      ))}
    </ul>
  );
}
