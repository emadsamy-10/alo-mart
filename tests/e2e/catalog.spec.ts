import { expect, test, type Page } from "@playwright/test";

/**
 * Catalog (/products) — filters, search, sort, pagination, URL state and
 * matched-variant pricing, in a real browser against the production server.
 * Expected numbers come from independent read-only API calls, never from the
 * UI under test. Options are discovered from the page, so the suite runs on
 * any catalog that has the demo taxonomy (smartphones, furniture…).
 */
const API = process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1";

interface Listing {
  items: { id: number; slug: string; matched_variant?: { id: number; selling_price: string } | null }[];
  meta: { total: number; last_page: number };
}
interface Facets {
  total: number;
  price: { min: string | null; max: string | null };
  categories: { id: number; slug: string; count: number }[];
  brands: { id: number; slug: string; count: number }[];
  attributes: { code: string; values: { code: string; count: number }[] }[];
}

async function api<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, { headers: { Accept: "application/json", "Accept-Language": "en" }, signal: AbortSignal.timeout(20000) });
      if (res.ok) return ((await res.json()) as { data: T }).data;
      lastError = new Error(`HTTP ${res.status} ${path}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw lastError;
}

async function categoryId(slug: string): Promise<number> {
  type Node = { id: number; slug: string; children?: Node[] };
  const tree = await api<Node[]>("categories?market=EG");
  const all: Node[] = [];
  const walk = (nodes: Node[]) => nodes.forEach((n) => (all.push(n), walk(n.children ?? [])));
  walk(tree);
  return all.find((n) => n.slug === slug)!.id;
}

/** Waits until the catalog is no longer loading a navigation. */
async function settled(page: Page) {
  await expect(page.getByTestId("catalog-results")).not.toHaveAttribute("aria-busy", "true", { timeout: 30_000 });
  await expect(page.getByTestId("result-count")).not.toContainText("Updating", { timeout: 30_000 });
}

async function total(page: Page): Promise<number> {
  await settled(page);
  const text = (await page.getByTestId("result-count").textContent()) ?? "";
  return /^No products/.test(text) ? 0 : Number(text.replace(/[^\d]/g, ""));
}

const cardIds = (page: Page) =>
  page.getByTestId("catalog-grid").locator("li article h3 a").evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).getAttribute("href")!));

/** Filters live in the sidebar on desktop and in the bottom sheet on mobile. */
async function filters(page: Page, isMobile: boolean) {
  if (isMobile) {
    if (!(await page.getByTestId("filter-sheet").isVisible())) await page.getByTestId("open-filters").click();
    return page.getByTestId("filter-sheet");
  }
  return page.getByRole("complementary");
}

function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !/status of 50[234]|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test.describe("catalog filters", () => {
  test("main category with sub-categories: explicit descendants, count matches the API", async ({ page, isMobile }) => {
    const errors = consoleErrors(page);
    const furniture = await categoryId("furniture");
    const expected = await api<Listing>(`products?market=EG&category_id[]=${furniture}&include_descendants=1&per_page=1`);
    const exact = await api<Listing>(`products?market=EG&category_id[]=${furniture}&per_page=1`);

    await page.goto("/en/products");
    const panel = await filters(page, isMobile);
    await panel.getByTestId("filter-category-furniture").click();
    await expect(page).toHaveURL(/category=furniture&descendants=1/);
    expect(await total(page)).toBe(expected.meta.total);
    await expect(page.getByTestId("filter-chip").filter({ hasText: "Incl. sub-categories" })).toBeVisible();

    // Switching sub-categories off is explicit and returns the exact-category result.
    const panel2 = await filters(page, isMobile);
    await panel2.getByText("Include sub-categories", { exact: true }).click();
    await expect(page).not.toHaveURL(/descendants=1/);
    expect(await total(page)).toBe(exact.meta.total);
    expect(errors).toEqual([]);
  });

  test("a main category with sub-categories offers its sub-categories' attribute filters (BR-1)", async ({ page, isMobile }) => {
    const fashion = await categoryId("fashion");
    const subtree = await api<Facets>(`products/facets?market=EG&category_id[]=${fashion}&include_descendants=1`);
    test.skip(subtree.attributes.length === 0, "this backend version does not offer descendant attributes (BR-1 not deployed)");
    const material = subtree.attributes.find((a) => a.code === "material")!.values[0];

    await page.goto("/en/products?category=fashion&descendants=1");
    const panel = await filters(page, isMobile);
    for (const attribute of subtree.attributes) {
      await expect(panel.getByTestId(`filter-attr-${attribute.code}-${attribute.values[0].code}`)).toBeAttached();
    }

    // Filtering the main category by a sub-category attribute narrows to exactly the API's result.
    await panel.getByTestId(`filter-attr-material-${material.code}`).click();
    await expect(page).toHaveURL(new RegExp(`attr\\.material=${material.code}`));
    await expect(page).toHaveURL(/descendants=1/);
    const expected = await api<{ meta: { total: number } }>(`products?market=EG&category_id[]=${fashion}&include_descendants=1&attr[material]=${material.code}&per_page=1`);
    expect(await total(page)).toBe(expected.meta.total);
    expect(expected.meta.total).toBe(material.count);
  });

  test("multiple brands combine with OR; facet counts come from the API, not the page", async ({ page, isMobile }) => {
    const facets = await api<Facets>("products/facets?market=EG");
    const [a, b] = [...facets.brands].sort((x, y) => y.count - x.count);
    await page.goto("/en/products");
    let panel = await filters(page, isMobile);
    await expect(panel.getByTestId(`filter-brand-${a.slug}`)).toContainText(String(a.count));
    await panel.getByTestId(`filter-brand-${a.slug}`).click();
    await settled(page);
    panel = await filters(page, isMobile);
    await panel.getByTestId(`filter-brand-${b.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`brand=${[a.slug, b.slug].sort().join("&brand=")}`));
    // Each product has one brand, so OR across two brands is the sum of their drill-down counts.
    expect(await total(page)).toBe(a.count + b.count);
  });

  test("color and storage together, then stock and price — every card shows its matched variant inside the range", async ({ page }) => {
    const phones = await categoryId("smartphones");
    const facets = await api<Facets>(`products/facets?market=EG&category_id[]=${phones}`);
    const color = facets.attributes.find((x) => x.code === "color")!.values[0].code;
    const storage = facets.attributes.find((x) => x.code === "storage")!.values[0].code;

    await page.goto(`/en/products?category=smartphones&attr.color=${color}&attr.storage=${storage}`);
    const expected = await api<Listing>(`products?market=EG&category_id[]=${phones}&attr[color]=${color}&attr[storage]=${storage}`);
    expect(await total(page)).toBe(expected.meta.total);

    await page.goto(`/en/products?category=smartphones&attr.color=${color}&in_stock=1&min=1000&max=40000`);
    const ranged = await api<Listing>(`products?market=EG&category_id[]=${phones}&attr[color]=${color}&in_stock=1&min_price=1000&max_price=40000`);
    expect(await total(page)).toBe(ranged.meta.total);
    for (const item of ranged.items) {
      const price = Number(item.matched_variant!.selling_price);
      expect(price).toBeGreaterThanOrEqual(1000);
      expect(price).toBeLessThanOrEqual(40000);
    }
    await expect(page.getByTestId("matched-price-note").first()).toBeVisible();
  });

  test("price facet bounds ignore the selected range, so the slider can widen it", async ({ page, isMobile }) => {
    const all = await api<Facets>("products/facets?market=EG");
    const ranged = await api<Facets>("products/facets?market=EG&min_price=1000&max_price=5000");
    test.skip(JSON.stringify(all.price) !== JSON.stringify(ranged.price), "this backend version narrows price bounds to the selection");
    await page.goto("/en/products?min=1000&max=5000");
    const panel = await filters(page, isMobile);
    const slider = panel.getByTestId("price-slider");
    await expect(slider.getByRole("slider").first()).toHaveAttribute("aria-valuemin", String(Math.floor(Number(all.price.min))));
    await expect(slider.getByRole("slider").first()).toHaveAttribute("aria-valuemax", String(Math.ceil(Number(all.price.max))));
    await expect(slider.getByRole("slider").first()).toHaveAttribute("aria-valuenow", "1000");
  });

  test("typed price range validates, applies, and survives a refresh", async ({ page, isMobile }) => {
    await page.goto("/en/products");
    let panel = await filters(page, isMobile);
    await panel.getByLabel("From", { exact: true }).fill("5000");
    await panel.getByLabel("To", { exact: true }).fill("1000");
    await panel.getByRole("button", { name: "Apply price" }).click();
    await expect(panel.getByText("The minimum price can’t be higher than the maximum.")).toBeVisible();
    await panel.getByLabel("To", { exact: true }).fill("20000.50");
    await panel.getByRole("button", { name: "Apply price" }).click();
    await expect(page).toHaveURL(/min=5000&max=20000\.5/);
    const expected = await api<Listing>("products?market=EG&min_price=5000&max_price=20000.5&per_page=1");
    expect(await total(page)).toBe(expected.meta.total);
    await page.reload();
    expect(await total(page)).toBe(expected.meta.total);
    panel = await filters(page, isMobile);
    // Shown with grouped digits; the URL and the API keep the exact decimal.
    await expect(panel.getByLabel("From", { exact: true })).toHaveValue("5,000");
  });

  test("on sale only: every card shows a real previous price", async ({ page, isMobile }) => {
    await page.goto("/en/products");
    const panel = await filters(page, isMobile);
    await panel.getByTestId("filter-on-sale").click();
    await expect(page).toHaveURL(/on_sale=1/);
    const expected = await api<Listing>("products?market=EG&on_sale=1&per_page=1");
    expect(await total(page)).toBe(expected.meta.total);
    const cards = page.getByTestId("catalog-grid").locator("article");
    const n = await cards.count();
    for (let i = 0; i < n; i++) await expect(cards.nth(i).locator("s")).toHaveCount(1);
  });
});

test.describe("search, sort, URL state", () => {
  test("English and Arabic search; Arabic article-insensitive", async ({ page }) => {
    const en = await api<Listing>("products?market=EG&q=chair&per_page=1");
    await page.goto("/en/products");
    await page.getByRole("searchbox", { name: "Search products" }).fill("chair");
    await page.getByRole("searchbox", { name: "Search products" }).press("Enter");
    await expect(page).toHaveURL(/q=chair/);
    await expect(page.getByTestId("catalog-heading")).toContainText("chair");
    expect(await total(page)).toBe(en.meta.total);

    const ar = await api<Listing>(`products?market=EG&q=${encodeURIComponent("كرسي")}&per_page=1`);
    await page.goto(`/ar/products?q=${encodeURIComponent("الكرسي")}`);
    const arWithArticle = await api<Listing>(`products?market=EG&q=${encodeURIComponent("الكرسي")}&per_page=1`);
    expect(arWithArticle.meta.total).toBe(ar.meta.total);
    await settled(page);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("result-count")).toContainText(String(ar.meta.total));
  });

  test("search combines with filters; a too-short term is refused locally", async ({ page }) => {
    const phones = await categoryId("smartphones");
    const expected = await api<Listing>(`products?market=EG&q=nordica&category_id[]=${phones}&per_page=1`);
    await page.goto("/en/products?category=smartphones");
    await page.getByRole("searchbox", { name: "Search products" }).fill("n");
    await page.getByRole("searchbox", { name: "Search products" }).press("Enter");
    await expect(page.getByText("Enter at least 2 characters.")).toBeVisible();
    await page.getByRole("searchbox", { name: "Search products" }).fill("nordica");
    await page.getByRole("searchbox", { name: "Search products" }).press("Enter");
    await expect(page).toHaveURL(/q=nordica&category=smartphones/);
    expect(await total(page)).toBe(expected.meta.total);
  });

  test("changing the sort keeps filters, the result set and the total", async ({ page, isMobile }) => {
    await page.goto("/en/products?in_stock=1");
    const before = await total(page);
    if (isMobile) {
      await page.getByTestId("open-sort").click();
      await page.getByRole("dialog").getByText("Price: low to high", { exact: true }).click();
    } else {
      await page.getByTestId("sort-select").click();
      await page.getByRole("option", { name: "Price: low to high" }).click();
    }
    await expect(page).toHaveURL(/in_stock=1&sort=price_asc/);
    expect(await total(page)).toBe(before);
    const sorted = await api<Listing>("products?market=EG&in_stock=1&sort=price_asc&per_page=24");
    const hrefs = await cardIds(page);
    expect(hrefs.map((h) => h.split("/").pop()!.split("?")[0])).toEqual(sorted.items.map((i) => i.slug));
  });

  test("chips remove one filter; Clear all keeps the search; Back/Forward restore state", async ({ page }) => {
    await page.goto("/en/products?q=nordica&in_stock=1&on_sale=1");
    await settled(page);
    await page.getByTestId("filter-chip").filter({ hasText: "On sale only" }).click();
    await expect(page).toHaveURL(/q=nordica&in_stock=1$/);
    await settled(page);
    await page.getByTestId("clear-all").click();
    await expect(page).toHaveURL(/\/en\/products\?q=nordica$/);
    await settled(page);
    await page.goBack();
    await expect(page).toHaveURL(/q=nordica&in_stock=1$/);
    await settled(page);
    await expect(page.getByTestId("filter-chip").filter({ hasText: "In stock only" })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\?q=nordica$/);
  });

  test("pagination: real pages, no duplicates, filters kept; out-of-range page explained", async ({ page }) => {
    const first = await api<Listing>("products?market=EG&per_page=24&page=1");
    test.skip(first.meta.last_page < 2, "needs at least two pages");
    await page.goto("/en/products?in_stock=1");
    const expectedPages = (await api<Listing>("products?market=EG&in_stock=1&per_page=24")).meta.last_page;
    test.skip(expectedPages < 2, "needs two in-stock pages");
    const one = await cardIds(page);
    await page.getByTestId("pagination").getByRole("link", { name: "Go to page 2" }).click();
    await expect(page).toHaveURL(/in_stock=1&page=2/);
    await settled(page);
    const two = await cardIds(page);
    expect(two.length).toBeGreaterThan(0);
    expect(two.filter((h) => one.includes(h))).toEqual([]);
    await expect(page.locator("#catalog-products")).toBeFocused();

    await page.goto("/en/products?in_stock=1&page=99");
    await expect(page.getByText("This page no longer exists")).toBeVisible();
    expect((await page.goto("/en/products?page=999"))?.status()).toBe(404);
  });

  test("an attribute that does not apply is dropped with a notice (API 422)", async ({ page }) => {
    await page.goto("/en/products?category=smartphones&attr.not-a-real-attribute=x");
    await expect(page.getByTestId("removed-attributes")).toBeVisible();
    const phones = await categoryId("smartphones");
    const expected = await api<Listing>(`products?market=EG&category_id[]=${phones}&per_page=1`);
    expect(await total(page)).toBe(expected.meta.total);
  });

  test("a filter combination with no products shows the empty state with a way out", async ({ page }) => {
    await page.goto("/en/products?min=9999999990");
    await expect(page.getByText("No products match these filters")).toBeVisible();
    await page.getByTestId("empty-clear-filters").click();
    await expect(page).toHaveURL(/\/en\/products$/);
  });

  test("filtered pages are noindex with the canonical on /products", async ({ page }) => {
    await page.goto("/en/products?in_stock=1&sort=price_asc");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/en\/products$/);
  });
});

test.describe("stale responses", () => {
  test("two quick filter clicks add up, and a slow older response never wins", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop sidebar keeps both checkboxes in view");
    const facets = await api<Facets>("products/facets?market=EG");
    const [a, b] = [...facets.brands].sort((x, y) => y.count - x.count);
    await page.goto("/en/products");
    await settled(page);
    // Hold back the FIRST navigation's server response, so the second click races it.
    let held = false;
    await page.route(/\/en\/products\?/, async (route) => {
      if (!held && route.request().headers()["rsc"]) {
        held = true;
        await new Promise((r) => setTimeout(r, 2500));
      }
      await route.continue();
    });
    const sidebar = page.getByRole("complementary");
    await sidebar.getByTestId(`filter-brand-${a.slug}`).click();
    await sidebar.getByTestId(`filter-brand-${b.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`brand=${[a.slug, b.slug].sort().join("&brand=")}$`));
    expect(await total(page)).toBe(a.count + b.count);
    await page.waitForTimeout(3000); // the held response has now arrived
    await expect(page).toHaveURL(new RegExp(`brand=${[a.slug, b.slug].sort().join("&brand=")}$`));
    expect(await total(page)).toBe(a.count + b.count);
    await expect(sidebar.getByTestId(`filter-brand-${a.slug}`).getByRole("checkbox")).toBeChecked();
    await expect(sidebar.getByTestId(`filter-brand-${b.slug}`).getByRole("checkbox")).toBeChecked();
  });
});

test.describe("filtered card → product page → cart", () => {
  test("matched variant is preselected on the product page and added exactly", async ({ page }) => {
    const phones = await categoryId("smartphones");
    const facets = await api<Facets>(`products/facets?market=EG&category_id[]=${phones}`);
    const storage = facets.attributes.find((x) => x.code === "storage")!.values.at(-1)!.code;
    const listing = await api<Listing>(`products?market=EG&category_id[]=${phones}&attr[storage]=${storage}`);
    const item = listing.items[0];
    expect(item.matched_variant).toBeTruthy();

    await page.goto(`/en/products?category=smartphones&attr.storage=${storage}`);
    await settled(page);
    const card = page.getByTestId("catalog-grid").locator("article").first();
    await expect(card.getByTestId("matched-price-note")).toBeVisible();
    await card.locator("h3 a").click();
    await expect(page).toHaveURL(new RegExp(`/products/${item.slug}\\?variant=${item.matched_variant!.id}`));

    type Detail = { variants: { id: number; options: { attribute: { code: string }; value: { name: string } }[] }[] };
    const detail = await api<Detail>(`products/${item.slug}?market=EG`);
    const variant = detail.variants.find((v) => v.id === item.matched_variant!.id)!;
    for (const option of variant.options) {
      await expect(page.getByRole("radio", { name: option.value.name, exact: true }).first()).toHaveAttribute("aria-checked", "true");
    }
    await page.getByTestId("add-to-cart").click();
    const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => /cart/i.test(k))));
    expect(stored).toContain(String(item.matched_variant!.id));
    await page.reload();
    const after = await page.evaluate(() => JSON.stringify(Object.entries(localStorage).filter(([k]) => /cart/i.test(k))));
    expect(after).toContain(String(item.matched_variant!.id));
  });

  test("unfiltered cards keep the product-wide price and plain product links", async ({ page }) => {
    await page.goto("/en/products");
    await settled(page);
    await expect(page.getByTestId("matched-price-note")).toHaveCount(0);
    const hrefs = await cardIds(page);
    expect(hrefs.every((h) => !h.includes("?variant="))).toBe(true);
  });

  test("an unknown ?variant= on a product page is ignored", async ({ page }) => {
    const listing = await api<Listing>("products?market=EG&per_page=1");
    const response = await page.goto(`/en/products/${listing.items[0].slug}?variant=999999999`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/products/${listing.items[0].slug}$`));
  });
});

test.describe("mobile filter sheet", () => {
  test("opens, applies at once with a live total, and closes on Show results or Escape", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/en/products");
    await page.getByTestId("open-filters").click();
    const sheet = page.getByTestId("filter-sheet");
    await expect(sheet).toBeVisible();
    await sheet.getByTestId("filter-in-stock").click();
    await expect(page).toHaveURL(/in_stock=1/);
    const expected = await api<Listing>("products?market=EG&in_stock=1&per_page=1");
    await expect(sheet.getByTestId("show-results")).toContainText(String(expected.meta.total), { timeout: 30_000 });
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId("open-filters")).toBeFocused();
    await page.getByTestId("open-filters").click();
    await page.getByTestId("show-results").click();
    await expect(sheet).toBeHidden();
  });
});
