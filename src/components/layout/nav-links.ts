/**
 * Primary navigation: every entry is a real route or a real catalog state
 * (sort and on-sale are supported by the API). Shared by the desktop bar and
 * the mobile drawer.
 */
export const NAV_LINKS = [
  { key: "home", href: "/" },
  { key: "allProducts", href: "/products" },
  { key: "stores", href: "/stores" },
  { key: "brands", href: "/brands" },
  { key: "designers", href: "/designers" },
  { key: "newArrivals", href: "/products?sort=newest" },
  { key: "bestSellers", href: "/products?sort=best_selling" },
  { key: "offers", href: "/products?on_sale=1" },
] as const;

export type NavKey = (typeof NAV_LINKS)[number]["key"];

/** Which navigation entry the current page belongs to (at most one). */
export function activeNavKey(pathname: string, params: { sort: string | null; onSale: string | null } | null): NavKey | null {
  if (pathname === "/") return "home";
  if (pathname === "/stores" || pathname.startsWith("/stores/")) return "stores";
  if (pathname === "/brands" || pathname.startsWith("/brands/")) return "brands";
  if (pathname === "/designers" || pathname.startsWith("/designers/") || pathname.startsWith("/designs/")) return "designers";
  if (pathname === "/products") {
    if (params?.onSale === "1") return "offers";
    if (params?.sort === "best_selling") return "bestSellers";
    if (params?.sort === "newest") return "newArrivals";
    return "allProducts";
  }
  return null;
}
