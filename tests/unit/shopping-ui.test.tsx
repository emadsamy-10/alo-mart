// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cartStore } from "@/features/cart/store";
import { MarketProvider } from "@/features/markets/MarketContext";
import { ProductGallery } from "@/features/products/gallery/ProductGallery";
import type { GalleryImage } from "@/features/products/gallery/types";
import { ProductSelectionProvider, type PurchasableProduct } from "@/features/products/purchase/ProductSelection";
import { PurchasePanel } from "@/features/products/purchase/PurchasePanel";
import { WishlistButton } from "@/features/wishlist/WishlistButton";
import { wishlistStore } from "@/features/wishlist/store";
import en from "../../messages/en.json";

vi.mock("@/features/cart/actions", () => ({ refreshCartLines: vi.fn(async () => []), refreshWishlist: vi.fn(async () => []) }));

beforeAll(() => {
  Element.prototype.scrollTo = function () {} as typeof Element.prototype.scrollTo;
  window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof IntersectionObserver;
});

beforeEach(() => {
  localStorage.clear();
  cartStore.set({});
  wishlistStore.set([]);
});

const wrap = (ui: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <MarketProvider market="EG">{ui}</MarketProvider>
  </NextIntlClientProvider>
);

const img = (id: number, src: string | null = `https://api.example.test/${id}.webp`): GalleryImage => ({
  id,
  alt: `Photo ${id}`,
  thumb: src && `${src}?t`,
  main: src,
  large: src && `${src}?l`,
});

describe("ProductGallery", () => {
  it("thumbnail click moves the active image and updates the counter", () => {
    render(wrap(<ProductGallery images={[img(1), img(2), img(3)]} productName="Tee" />));
    const thumbs = screen.getAllByTestId("gallery-thumb");
    expect(thumbs[0]).toHaveAttribute("aria-current", "true");
    fireEvent.click(thumbs[2]);
    expect(thumbs[2]).toHaveAttribute("aria-current", "true");
    expect(thumbs[0]).not.toHaveAttribute("aria-current");
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
  });

  it("arrow keys navigate and wrap around", () => {
    render(wrap(<ProductGallery images={[img(1), img(2)]} productName="Tee" />));
    const region = screen.getByRole("region", { name: "Photos of Tee" });
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 2")).toBeInTheDocument();
  });

  it("opens the zoom viewer, zooms, navigates and closes", () => {
    render(wrap(<ProductGallery images={[img(1), img(2)]} productName="Tee" />));
    fireEvent.click(screen.getByRole("button", { name: "Open image 1 of 2 in full screen" }));
    const dialog = screen.getByRole("dialog", { name: /Tee/ });
    const viewport = within(dialog).getByTestId("lightbox-viewport");
    expect(viewport).toHaveAttribute("data-zoom", "1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Zoom in" }));
    expect(viewport).toHaveAttribute("data-zoom", "2");
    fireEvent.click(viewport); // click while zoomed → back to fit
    expect(viewport).toHaveAttribute("data-zoom", "1");
    fireEvent.click(within(dialog).getByRole("button", { name: "Next image" }));
    expect(within(dialog).getByRole("button", { name: "Show image 2 of 2" })).toHaveAttribute("aria-current", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close viewer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a single image has no arrows, counter or thumbnails", () => {
    render(wrap(<ProductGallery images={[img(1)]} productName="Tee" />));
    expect(screen.queryByRole("button", { name: "Next image" })).toBeNull();
    expect(screen.queryAllByTestId("gallery-thumb")).toHaveLength(0);
  });

  it("shows a designed fallback when there are no images or an image URL is missing", () => {
    const { unmount } = render(wrap(<ProductGallery images={[]} productName="Tee" />));
    expect(screen.getByRole("img", { name: "Tee" })).toBeInTheDocument();
    expect(screen.getByText("No image available")).toBeInTheDocument();
    unmount();
    render(wrap(<ProductGallery images={[img(1, null)]} productName="Tee" />));
    expect(screen.getByText("No image available")).toBeInTheDocument();
  });
});

const color = (id: number, name: string, hex: string) => ({
  attribute: { id: 5, name: "Color", code: "color", input_type: "color" },
  value: { id, name, code: name.toLowerCase(), display_value: hex },
});
const size = (id: number, name: string) => ({
  attribute: { id: 9, name: "Size", code: "size", input_type: "select" },
  value: { id, name, code: name.toLowerCase(), display_value: null },
});

const product: PurchasableProduct = {
  id: 42,
  slug: "tee",
  name: "Essential Tee",
  imageUrl: null,
  currency: { code: "EGP", symbol: "ج.م", decimal_places: 2 },
  gallery: [img(1)],
  variants: [
    { id: 1, sku: "BLK-S", price: "449.0000", sale_price: null, is_in_stock: true, options: [color(28, "Black", "#1F1F1F"), size(1, "S")], gallery: [] },
    { id: 2, sku: "BLK-M", price: "449.0000", sale_price: null, is_in_stock: false, options: [color(28, "Black", "#1F1F1F"), size(2, "M")], gallery: [] },
    { id: 3, sku: "WHT-M", price: "500.0000", sale_price: "450.0000", is_in_stock: true, options: [color(29, "White", "#F5F5F2"), size(2, "M")], gallery: [] },
  ],
};

const panel = () =>
  render(
    wrap(
      <ProductSelectionProvider product={product}>
        <PurchasePanel />
      </ProductSelectionProvider>,
    ),
  );

describe("PurchasePanel", () => {
  it("opens on an in-stock variant with its price, SKU and availability", () => {
    panel();
    expect(screen.getByTestId("pdp-price")).toHaveTextContent("EGP 449");
    expect(screen.getByTestId("pdp-stock")).toHaveTextContent("In stock");
    expect(screen.getByText("SKU: BLK-S")).toBeInTheDocument();
  });

  it("updates price and availability when another variant is chosen", () => {
    panel();
    fireEvent.click(screen.getByRole("radio", { name: "M — out of stock" }));
    expect(screen.getByTestId("pdp-stock")).toHaveTextContent("Out of stock");
    expect(screen.getByTestId("add-to-cart")).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: "White" }));
    expect(screen.getByTestId("pdp-price")).toHaveTextContent("EGP 450");
    expect(screen.getByText("Was EGP 500")).toBeInTheDocument();
    expect(screen.getByTestId("add-to-cart")).toBeEnabled();
  });

  it("disables impossible combinations", () => {
    panel();
    fireEvent.click(screen.getByRole("radio", { name: "White" })); // White only exists in M
    expect(screen.getByRole("radio", { name: "S" })).toBeDisabled();
  });

  it("asks for a missing option instead of adding the wrong variant", () => {
    panel();
    fireEvent.click(screen.getByRole("radio", { name: "White" })); // Size reset (S impossible)
    fireEvent.click(screen.getByTestId("add-to-cart"));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose a Size to continue.");
    expect(cartStore.get().EG).toBeUndefined();
  });

  it("validates quantity and adds the chosen variant to the market's cart", () => {
    panel();
    const qty = screen.getByTestId("pdp-quantity");
    fireEvent.change(qty, { target: { value: "0" } });
    expect(qty).toHaveValue(1);
    fireEvent.change(qty, { target: { value: "500" } });
    expect(qty).toHaveValue(99);
    fireEvent.change(qty, { target: { value: "2" } });
    act(() => fireEvent.click(screen.getByTestId("add-to-cart")));
    expect(cartStore.get().EG).toMatchObject([{ variantId: 1, quantity: 2, variantLabel: "Black / S", unitPrice: "449.0000" }]);
    expect(JSON.parse(localStorage.getItem("alo_cart_v1")!).EG[0].quantity).toBe(2);
  });
});

describe("WishlistButton", () => {
  it("shares saved state between every button for the same product and persists it", () => {
    const p = { id: 42, slug: "tee", name: "Essential Tee", imageUrl: null };
    render(
      wrap(
        <>
          <WishlistButton product={p} />
          <WishlistButton product={p} variant="outline" />
        </>,
      ),
    );
    const [card, details] = screen.getAllByRole("button", { name: "Save Essential Tee to wishlist" });
    act(() => fireEvent.click(card));
    expect(card).toHaveAttribute("aria-pressed", "true");
    expect(details).toHaveAttribute("aria-pressed", "true");
    expect(details).toHaveAccessibleName("Remove Essential Tee from wishlist");
    expect(JSON.parse(localStorage.getItem("alo_wishlist_v1")!)).toHaveLength(1);
  });
});
