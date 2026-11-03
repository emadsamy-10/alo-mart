import { expect as baseExpect, test, type Page } from "@playwright/test";

/**
 * Discovery journeys (read-only — safe against staging or the local API):
 * header search, store directory and store pages, footer links, and the
 * guest path Homepage → Category → Product → Cart.
 */
const API = process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1";
/** Server-rendered navigations against a slow local API or staging can take a few seconds. */
const expect = baseExpect.configure({ timeout: 15_000 });
/** Product cards are <article> elements in the main content. */
const cards = (page: Page) => page.locator("main article");

async function api<T>(path: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(15000) });
      if (res.ok) return ((await res.json()) as { data: T }).data;
      last = new Error(`HTTP ${res.status}`);
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw last;
}

function pageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.describe("discovery", () => {
  test("header search submits to the real catalog search (desktop popover / mobile menu)", async ({ page, isMobile }) => {
    const errors = pageErrors(page);
    await page.goto("/en");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("dialog").getByTestId("header-search").getByRole("searchbox").fill("shirt");
      await page.getByRole("dialog").getByRole("button", { name: "Search", exact: true }).click();
    } else {
      await page.getByTestId("header-search-button").click();
      const box = page.getByTestId("header-search").getByRole("searchbox");
      await expect(box).toBeFocused();
      await box.fill("shirt");
      await box.press("Enter");
    }
    await expect(page).toHaveURL(/\/en\/products\?q=shirt$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("shirt");
    expect(errors).toEqual([]);
  });

  test("Arabic search from the header lands on the Arabic catalog", async ({ page, isMobile }) => {
    test.skip(isMobile, "covered by the English mobile test");
    await page.goto("/ar");
    await page.getByTestId("header-search-button").click();
    await page.getByTestId("header-search").getByRole("searchbox").fill("قميص");
    await page.getByTestId("header-search").getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/ar\/products\?q=/);
    expect(decodeURIComponent(new URL(page.url()).searchParams.get("q") ?? "")).toBe("قميص");
  });

  test("store directory lists every public store and opens a store page with its products", async ({ page }) => {
    const errors = pageErrors(page);
    const stores = await api<{ items: { slug: string; name: string }[]; meta: { total: number } }>("stores?per_page=100");
    await page.goto("/en/stores");
    await expect(page.getByRole("heading", { level: 1, name: "Stores" })).toBeVisible();
    await expect(page.getByTestId("stores").locator("li")).toHaveCount(stores.items.length);

    const products = await api<{ items: { store: { slug: string; name: string } | null }[] }>("products?market=EG&per_page=1");
    const store = products.items[0].store!;
    await page.getByTestId("stores").getByRole("link", { name: store.name }).click();
    await expect(page).toHaveURL(new RegExp(`/en/stores/${store.slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: store.name })).toBeVisible();
    await expect(cards(page).first()).toBeVisible();
    await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
    expect(errors).toEqual([]);
  });

  test("an unknown store is a real 404", async ({ page }) => {
    expect((await page.goto("/en/stores/this-store-does-not-exist"))?.status()).toBe(404);
  });

  test("product page links its seller's store", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop is enough for a link");
    const listing = await api<{ items: { slug: string; store: { slug: string; name: string } | null }[] }>("products?market=EG&per_page=1");
    const product = listing.items[0];
    await page.goto(`/en/products/${product.slug}`);
    await page.getByRole("link", { name: `Sold by ${product.store!.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/en/stores/${product.store!.slug}$`));
  });

  test("footer shop links work; the support email shows only when the platform publishes one", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop is enough for links");
    const settings = await api<{ key: string; value: unknown }[]>("settings");
    const email = settings.find((s) => s.key === "platform.support_email")?.value;
    await page.goto("/en");
    const footer = page.locator("footer");
    for (const [name, url] of [
      ["All products", /\/en\/products$/],
      ["Stores", /\/en\/stores$/],
    ] as const) {
      await footer.getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(url);
      await page.goBack();
    }
    if (typeof email === "string") await expect(footer.getByTestId("footer-support-email")).toHaveAttribute("href", `mailto:${email}`);
    else await expect(footer.getByTestId("footer-support-email")).toHaveCount(0);
  });

  test("guest journey: homepage → category → product → cart → checkout asks to sign in", async ({ page }) => {
    const errors = pageErrors(page);
    const tree = await api<{ slug: string; name: string; children: unknown[] }[]>("categories?market=EG");
    await page.goto("/en");
    await page.goto(`/en/categories/${tree[0].slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const card = cards(page).first();
    await card.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/en\/products\/[a-z0-9-]+/);
    const add = page.getByTestId("add-to-cart");
    if (await add.isEnabled()) {
      await add.click();
      await expect(page.getByTestId("cart-drawer")).toBeVisible();
      await page.getByTestId("cart-drawer").getByTestId("proceed-to-checkout").click();
      await expect(page).toHaveURL(/\/en\/login\?next=%2Fcheckout$/);
    }
    expect(errors).toEqual([]);
  });
});
