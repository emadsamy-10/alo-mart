import { expect, test, type Page } from "@playwright/test";

/**
 * The approved storefront shell against the real API: navigation destinations,
 * mega menu, pinned header without layout shift, hero controls, the card's cart
 * button, mobile navigation and theme. Read-only except the browser's own cart.
 */
const API = process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(20_000) });
  return ((await res.json()) as { data: T }).data;
}

function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return errors;
}

test.describe("desktop shell", () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "desktop navigation"));

  test("every primary link reaches a real page and the active link is marked", async ({ page }) => {
    const errors = pageErrors(page);
    await page.goto("/en");
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    for (const [name, url, heading] of [
      ["All products", /\/en\/products$/, "All products"],
      ["Stores", /\/en\/stores$/, "Stores"],
      ["Brands", /\/en\/brands$/, "Brands"],
      ["New arrivals", /\/en\/products\?sort=newest$/, null],
      ["Best sellers", /\/en\/products\?sort=best_selling$/, null],
      ["Offers", /\/en\/products\?on_sale=1$/, null],
    ] as const) {
      await nav.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (heading) await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
      await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("aria-current", "page");
    }
    expect(errors).toEqual([]);
  });

  test("the mega menu is closed at rest, stays in the viewport, closes on Escape and navigates", async ({ page, viewport }) => {
    const tree = await api<{ name: string; slug: string; children: { name: string; slug: string }[] }[]>("categories?market=EG");
    await page.goto("/en");
    const menu = page.getByTestId("mega-menu");
    await expect(menu).toHaveCount(0);

    const trigger = page.getByTestId("mega-menu-trigger");
    await trigger.click();
    await expect(menu).toBeVisible();
    for (const department of tree) await expect(menu.getByRole("link", { name: department.name, exact: true }).first()).toBeVisible();
    const box = (await menu.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const child = tree.find((d) => d.children.length)!.children[0];
    await menu.getByRole("link", { name: child.name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/en/categories/${child.slug}$`));
    await expect(menu).toHaveCount(0);
  });

  test("the header pins with no layout shift and a compact row keeps search and cart", async ({ page }) => {
    await page.goto("/en");
    const header = page.locator("header");
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await expect(page.getByTestId("header-search-button")).toBeHidden();

    await page.evaluate(() => window.scrollTo(0, 700));
    await expect(header).toHaveAttribute("data-stuck", "true");
    await expect(page.getByTestId("header-search-button")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeInViewport();

    await page.getByTestId("header-search-button").click();
    await page.getByRole("dialog").getByRole("searchbox").fill("shirt");
    await page.getByRole("dialog").getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/en\/products\?q=shirt$/);
  });

  test("hero slides move with the arrows and dots when more than one exists", async ({ page }) => {
    await page.goto("/en");
    const next = page.getByTestId("hero-next");
    if (!(await next.count())) test.skip(true, "this market curates one hero slide");
    const dots = page.getByTestId("hero").getByRole("button", { name: /Go to slide/ });
    await expect(dots.first()).toHaveAttribute("aria-current", "true");
    await next.click();
    await expect(dots.nth(1)).toHaveAttribute("aria-current", "true");
    await page.getByTestId("hero-previous").click();
    await expect(dots.first()).toHaveAttribute("aria-current", "true");
  });

  test("brand directory lists the API's brands and opens a brand", async ({ page }) => {
    const brands = await api<{ name: string; slug: string }[]>("brands");
    await page.goto("/en/brands");
    await expect(page.getByTestId("brands").locator("li")).toHaveCount(brands.length);
    await page.getByTestId("brands").getByRole("link", { name: brands[0].name }).click();
    await expect(page).toHaveURL(new RegExp(`/en/brands/${brands[0].slug}$`));
  });

  test("theme switch from the utility bar", async ({ page }) => {
    await page.goto("/en");
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitemradio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("product card cart button", () => {
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "desktop flow; the same button is shown on phones"));

  async function findBy(single: boolean) {
    const list = await api<{ items: { slug: string; name: string; is_in_stock: boolean }[] }>("products?market=EG&per_page=100");
    for (const item of list.items.filter((p) => p.is_in_stock)) {
      const detail = await api<{ variants: { is_in_stock: boolean }[] }>(`products/${item.slug}?market=EG`);
      if (single ? detail.variants.length === 1 && detail.variants[0].is_in_stock : detail.variants.length > 1) return item;
    }
    return null;
  }

  test("adds a single-variant product and opens the cart", async ({ page }) => {
    const product = await findBy(true);
    test.skip(!product, "no single-variant product in this catalog");
    await page.goto(`/en/products?q=${encodeURIComponent(product!.name)}`);
    await page.getByRole("button", { name: `Add ${product!.name} to cart` }).click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await expect(page.getByTestId("cart-drawer")).toBeVisible();
  });

  test("sends a product with options to its page to choose", async ({ page }) => {
    const product = await findBy(false);
    test.skip(!product, "no multi-variant product in this catalog");
    await page.goto(`/en/products?q=${encodeURIComponent(product!.name)}`);
    await page.getByRole("button", { name: `Add ${product!.name} to cart` }).click();
    await expect(page).toHaveURL(new RegExp(`/en/products/${product!.slug}`));
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });
});

test.describe("mobile navigation", () => {
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "phones"));

  test("bottom navigation reaches departments, cart and account; the search stays pinned", async ({ page }) => {
    const errors = pageErrors(page);
    await page.goto("/en");
    const bottom = page.getByTestId("bottom-nav");
    await expect(bottom).toBeVisible();

    await bottom.getByRole("button", { name: "Departments" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByTestId("mobile-nav-links").getByRole("link", { name: "All products" })).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).click();

    await bottom.getByRole("button", { name: /cart/i }).click();
    await expect(page.getByTestId("cart-drawer")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.locator("header").getByTestId("header-search").getByRole("searchbox")).toBeInViewport();

    await bottom.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/login/);
    expect(errors).toEqual([]);
  });

  test("the bottom navigation steps aside on product pages", async ({ page }) => {
    const list = await api<{ items: { slug: string }[] }>("products?market=EG&per_page=1");
    await page.goto(`/en/products/${list.items[0].slug}`);
    await expect(page.getByTestId("bottom-nav")).toHaveCount(0);
  });
});
