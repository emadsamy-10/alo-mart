import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const locale of ["ar", "en"] as const) {
  test.describe(`homepage /${locale}`, () => {
    test("renders server-side with correct lang/dir, SEO head and real sections", async ({ page }) => {
      const errors = collectErrors(page);
      const response = await page.goto(`/${locale}`);
      expect(response?.status()).toBe(200);

      const html = page.locator("html");
      await expect(html).toHaveAttribute("lang", locale);
      await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${locale}$`));
      await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
      await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);

      // Admin-controlled sections from the API (EG has content on staging).
      const sections = page.locator("section[data-section-type]");
      expect(await sections.count()).toBeGreaterThan(0);
      await expect(page.locator('a[href*="/products/"]').first()).toBeVisible();

      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  });
}

test("homepage content is in the HTML without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en");
  await expect(page.locator("h1")).toBeVisible();
  expect(await page.locator('section[data-section-type] a[href*="/en/products/"]').count()).toBeGreaterThan(4);
  await context.close();
});

test("staging is not indexable", async ({ page, request }) => {
  const response = await page.goto("/en");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \//);
});

test("sitemap lists localized URLs with alternates", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/ar</loc>");
  // Every language version is its own <url>, not only an alternate of the Arabic one.
  expect(xml).toContain("/en</loc>");
  expect(xml).toMatch(/\/en\/products\/[^<]+<\/loc>/);
  expect(xml).toContain('hreflang="en"');
  expect(xml).toContain("/products/");
});

test("product cards lead to a real product page with Product JSON-LD", async ({ page }) => {
  await page.goto("/en");
  const href = await page.locator('section[data-section-type] a[href*="/en/products/"]').first().getAttribute("href");
  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toBeVisible();
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  const data = JSON.parse(jsonLd!);
  const product = (Array.isArray(data) ? data : [data]).find((d: { "@type": string }) => d["@type"] === "Product");
  expect(product.offers.priceCurrency).toBe("EGP");
  expect(product).not.toHaveProperty("aggregateRating");
});

test("unknown product and unknown path return 404", async ({ page }) => {
  expect((await page.goto("/en/products/this-product-does-not-exist"))?.status()).toBe(404);
  expect((await page.goto("/ar/no-such-page"))?.status()).toBe(404);
  // Its own title, not the homepage's.
  await expect(page).toHaveTitle(/هذه الصفحة غير موجودة/);
  expect((await page.goto("/en/no-such-page"))?.status()).toBe(404);
  await expect(page).toHaveTitle(/This page doesn.t exist/);
});

test("store, brand and category headers fit a 320px window with a classic scrollbar in Arabic (long single-word names)", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "width is set explicitly");
  // 320px window minus a 15px classic scrollbar (desktop browsers): the narrowest layout seen in QA.
  await page.setViewportSize({ width: 305, height: 800 });
  for (const path of ["/ar/stores/volta-electronics", "/ar/brands/nilewood", "/ar/categories/electronics"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBe(0);
  }
});

test("root redirects to a locale", async ({ page }) => {
  await page.goto("/");
  expect(new URL(page.url()).pathname).toMatch(/^\/(ar|en)$/);
});

test("language switch keeps the current page", async ({ page, isMobile }) => {
  await page.goto("/ar/categories/office-furniture");
  // Desktop: utility bar toggle; mobile: footer language list.
  const link = isMobile ? page.locator('footer a[hreflang="en"]') : page.locator('a[hreflang="en"]').first();
  await link.click();
  await page.waitForURL("**/en/categories/office-furniture");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("market switch re-renders prices for the chosen market", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /^Market:/ }).click();
  await page.getByRole("button", { name: /Saudi Arabia/ }).click();
  // SA currently has no merchandising on staging → honest empty state, not an error.
  await expect(page.getByRole("heading", { name: /Nothing to show in Saudi Arabia/ })).toBeVisible();
  await page.getByRole("button", { name: /^Market:/ }).click();
  await page.getByRole("button", { name: /Egypt/ }).click();
  await expect(page.locator("section[data-section-type]").first()).toBeVisible();
});
