import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 2 shopping flows in a real browser against the production server and
 * the live staging API (read-only GETs for expected values).
 */
const API = process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1";
const PRODUCT = "cotton-lane-essential-crew-neck-t-shirt"; // 4 photos, Color × Size variants

/** Read-only GET for expected values; retried because the staging host drops connections intermittently. */
async function api<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return ((await res.json()) as { data: T }).data;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw lastError;
}

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Image-proxy timeouts from the staging image host are environmental, not app errors.
    if (m.type() === "error" && !/status of 50[234]/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe("product details", () => {
  test("gallery: thumbnails, zoom viewer, keyboard, close restores focus", async ({ page, isMobile }) => {
    const errors = consoleErrors(page);
    await page.goto(`/en/products/${PRODUCT}`);
    const thumbs = page.getByTestId("gallery-thumb");
    await expect(thumbs).toHaveCount(4);
    await expect(thumbs.nth(0)).toHaveAttribute("aria-current", "true");
    await thumbs.nth(2).click();
    await expect(thumbs.nth(2)).toHaveAttribute("aria-current", "true");
    await expect(page.getByText("3 / 4").first()).toBeVisible();

    const opener = page.getByRole("button", { name: "Open image 3 of 4 in full screen" });
    await opener.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const viewport = dialog.getByTestId("lightbox-viewport");
    await expect(viewport).toHaveAttribute("data-zoom", "1");
    await dialog.getByRole("button", { name: "Zoom in" }).click();
    await expect(viewport).toHaveAttribute("data-zoom", "2");
    await dialog.getByRole("button", { name: "Zoom out" }).click();
    if (!isMobile) {
      await page.keyboard.press("ArrowRight");
      await expect(dialog.getByRole("button", { name: "Show image 4 of 4" })).toHaveAttribute("aria-current", "true");
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator(":focus")).toHaveAttribute("aria-label", /in full screen/);
    expect(errors).toEqual([]);
  });

  test("variants, quantity, add to cart, drawer update/remove, persistence", async ({ page }) => {
    await page.goto(`/en/products/${PRODUCT}`);
    await page.getByRole("radio", { name: "White" }).click();
    await page.getByRole("radio", { name: "XL" }).click();
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-XL")).toBeVisible();
    await page.getByRole("button", { name: "Increase quantity" }).first().click();
    await expect(page.getByTestId("pdp-quantity")).toHaveValue("2");
    await page.getByTestId("add-to-cart").click();

    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("cart-line")).toHaveCount(1);
    await expect(drawer.getByText("White / XL")).toBeVisible();
    await expect(drawer.getByTestId("cart-line-qty")).toHaveText("2");
    await expect(drawer.getByTestId("cart-subtotal")).toHaveText(/898/);
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(drawer.getByTestId("cart-line-qty")).toHaveText("3");
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cart-count").first()).toHaveText("3");

    // Same variant again merges; another variant is a separate line.
    await page.getByTestId("add-to-cart").click();
    await expect(drawer.getByTestId("cart-line-qty")).toHaveText("5");
    await page.keyboard.press("Escape");
    await page.getByRole("radio", { name: "Black" }).click();
    await page.getByRole("radio", { name: "S", exact: true }).click();
    await page.getByTestId("add-to-cart").click();
    await expect(drawer.getByTestId("cart-line")).toHaveCount(2);

    await page.reload();
    // 5 × White/XL + 2 × Black/S (the quantity selector keeps its value between adds).
    await expect(page.getByTestId("cart-count").first()).toHaveText("7");
    await page.goto("/en/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(2);
    await page.getByRole("button", { name: /^Remove / }).first().click();
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await page.getByRole("button", { name: "Clear cart" }).click();
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("the cart is per market: switching market shows that market's cart", async ({ page }) => {
    await page.goto(`/en/products/${PRODUCT}`);
    await page.getByTestId("add-to-cart").click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await page.context().addCookies([{ name: "alo_market", value: "SA", url: "http://localhost:3100" }]);
    await page.goto("/en/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await page.context().addCookies([{ name: "alo_market", value: "EG", url: "http://localhost:3100" }]);
    await page.goto("/en/cart");
    await expect(page.getByTestId("cart-line")).toHaveCount(1);
  });

  test("mobile sticky bar appears after jumping past the main button, even without intermediate scroll", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the sticky bar is mobile only");
    await page.goto(`/en/products/${PRODUCT}`);
    const bar = page.getByTestId("sticky-purchase-bar");
    await expect(bar).toHaveAttribute("aria-hidden", "true");
    // One instant jump from top to below the button (fast fling / restored scroll position).
    const buttonTop = await page.getByTestId("add-to-cart").evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), buttonTop + 300);
    await expect(bar).toHaveAttribute("aria-hidden", "false");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(bar).toHaveAttribute("aria-hidden", "true");
  });

  test("wishlist: save on product page, shared with cards, persists, wishlist page", async ({ page }) => {
    await page.goto(`/en/products/${PRODUCT}`);
    const save = page.getByRole("button", { name: "Save Cotton Lane Essential Crew-Neck T-Shirt to wishlist" });
    await save.click();
    await expect(page.getByRole("button", { name: "Remove Cotton Lane Essential Crew-Neck T-Shirt from wishlist" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Remove Cotton Lane Essential Crew-Neck T-Shirt from wishlist" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/en/products?brand=cotton-lane");
    await expect(page.getByRole("button", { name: "Remove Cotton Lane Essential Crew-Neck T-Shirt from wishlist" })).toHaveAttribute("aria-pressed", "true");

    await page.goto("/en/wishlist");
    await expect(page.getByTestId("wishlist-item")).toHaveCount(1);
    await expect(page.getByTestId("wishlist-item").getByText(/EGP/)).toBeVisible();
    await page.getByRole("button", { name: /^Remove / }).click();
    await expect(page.getByText("No saved products yet")).toBeVisible();
  });

  test("server HTML carries the product, price and Product JSON-LD without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const detail = await api<{ name: string; price_from: string; currency: { code: string } }>(`products/${PRODUCT}?market=EG`);
    await page.goto(`/en/products/${PRODUCT}`);
    await expect(page.locator("h1")).toHaveText(detail.name);
    await expect(page.getByTestId("pdp-price")).toContainText("EGP");
    await expect(page.getByTestId("gallery-thumb")).toHaveCount(4);
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    const product = jsonLd.find((d: { "@type": string }) => d["@type"] === "Product");
    expect(product.offers.priceCurrency).toBe(detail.currency.code);
    expect(Number(product.offers.price ?? product.offers.lowPrice)).toBe(Number(detail.price_from));
    expect(product).not.toHaveProperty("aggregateRating");
    await context.close();
  });
});

test.describe("all products", () => {
  test("totals, brand + category filters, pagination and URL state are backed by the API", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop sidebar flow; the mobile sheet has its own test");
    const errors = consoleErrors(page);
    const all = await api<{ meta: { total: number; last_page: number } }>("products?market=EG&per_page=24");
    await page.goto("/en/products");
    await expect(page.getByTestId("result-count")).toHaveText(`${all.meta.total} products`);
    await expect(page.getByTestId("catalog-grid").locator("> li")).toHaveCount(24);

    const brand = await api<{ id: number }>("brands/kairo-tech");
    const byBrand = await api<{ meta: { total: number } }>(`products?market=EG&brand_id=${brand.id}&per_page=24`);
    await page.getByTestId("filter-brand-kairo-tech").first().click();
    await expect(page).toHaveURL(/\/en\/products\?brand=kairo-tech$/);
    await expect(page.getByTestId("result-count")).toHaveText(`${byBrand.meta.total} ${byBrand.meta.total === 1 ? "product" : "products"}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/products$/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    // Category filter keeps the brand; tree expands along the active path.
    await page.getByTestId("filter-category-electronics").click();
    await page.getByTestId("filter-category-computers").click();
    await page.getByTestId("filter-category-laptops").click();
    await expect(page).toHaveURL(/category=laptops&brand=kairo-tech/);
    await expect(page.getByTestId("filter-chip")).toHaveCount(2);
    const count = await page.getByTestId("catalog-grid").locator("> li").count();
    expect(count).toBeGreaterThan(0);

    // Back/forward walk the URL history.
    await page.goBack();
    await expect(page).toHaveURL(/category=computers&brand=kairo-tech/);
    await page.goForward();
    await expect(page).toHaveURL(/category=laptops&brand=kairo-tech/);

    // Reload keeps the filtered state; removing a chip drops only that filter.
    await page.reload();
    await expect(page.getByTestId("filter-chip")).toHaveCount(2);
    await page.getByRole("link", { name: "Remove filter: Kairo Tech" }).click();
    await expect(page).toHaveURL(/\/en\/products\?category=laptops$/);

    // Pagination preserves filters and reaches real pages.
    await page.goto("/en/products");
    if (all.meta.last_page > 1) {
      await page.getByRole("link", { name: "Go to page 2" }).click();
      await expect(page).toHaveURL(/\/en\/products\?page=2$/);
      await expect(page.getByRole("link", { name: "Go to page 2" })).toHaveAttribute("aria-current", "page");
    }
    expect(errors).toEqual([]);
  });

  test("invalid parameters are ignored; pages past the end are 404", async ({ page }) => {
    const res = await page.goto("/en/products?category=../../etc&brand=&page=abc&sort=price_asc");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("filter-chip")).toHaveCount(0);
    expect((await page.goto("/en/products?page=999"))?.status()).toBe(404);
    const unknown = await page.goto("/en/products?brand=does-not-exist");
    expect(unknown?.status()).toBe(200);
    await expect(page.getByTestId("filter-chip")).toHaveCount(0);
  });

  test("mobile bottom sheet applies filters through the URL", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/ar/products");
    await page.getByTestId("open-filters").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByText("كايرو تك", { exact: true }).click();
    await sheet.getByRole("button", { name: "عرض النتائج" }).click();
    await expect(page).toHaveURL(/\/ar\/products\?brand=kairo-tech$/);
    await expect(page.getByTestId("filter-chip")).toHaveCount(1);
    await page.getByTestId("open-filters").click();
    await page.getByRole("dialog").getByRole("button", { name: "مسح الكل" }).click();
    await expect(page).toHaveURL(/\/ar\/products$/);
  });
});
