import { expect, test } from "@playwright/test";

/**
 * Designers & Subscriptions — public pages (read-only; runs against any API).
 * Whatever the database holds, the hub shows real cards or an honest empty
 * state, never raw message keys, and the plans page never offers an online
 * payment.
 */

for (const locale of ["en", "ar"] as const) {
  test(`designers hub renders real data or an empty state (${locale})`, async ({ page }) => {
    const res = await page.goto(`/${locale}/designers`);
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    const grid = page.getByTestId("designs-grid");
    if ((await grid.count()) === 0) await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
    await page.getByTestId("tab-designers").click();
    await expect(page).toHaveURL(/tab=designers/);
    expect(await page.locator("body").innerText()).not.toMatch(/\bDesigners\.[a-z]+\.[a-zA-Z.]+/);
  });
}

test("plans page states that requests are not payments", async ({ page }) => {
  await page.goto("/en/subscriptions?for=customers");
  await expect(page.getByRole("note").first()).toContainText("Online payment is not available yet");
  await expect(page.getByRole("button", { name: /pay now|checkout/i })).toHaveCount(0);
});

test("unknown design and designer slugs are 404", async ({ page }) => {
  expect((await page.goto("/en/designs/no-such-design-zz"))?.status()).toBe(404);
  expect((await page.goto("/en/designers/no-such-designer-zz"))?.status()).toBe(404);
});
