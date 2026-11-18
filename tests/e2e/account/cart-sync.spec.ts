import { ACCOUNT_E2E, TEE, api, createShopper, ensureTestStock, expect, signIn, test } from "./helpers";

/**
 * A signed-in customer's cart and wishlist changes reach the account even when they leave the page
 * straight away (real-customer QA, 2026-11-10 — journey test 70). The writes used to be Next.js server
 * actions: they run one at a time, so an Add to cart queued behind wishlist saves was dropped by a
 * full navigation while the header already showed the item. Checked against the account on the API.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

const VARIANT = 49; // White / L

test.describe("account cart writes survive leaving the page", () => {
  test("92 wishlist save, remove, Add to cart, then straight to the cart page: the item is in the account", async ({ page }) => {
    const shopper = await createShopper("cart-race");
    await signIn(page, shopper);
    await page.goto(`/en/products/${TEE}?variant=${VARIANT}`);
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-L")).toBeVisible();

    // The exact sequence of journey test 70, with no waiting in between.
    await page.getByRole("button", { name: /^Save / }).first().click();
    await page.getByRole("button", { name: /^Remove .* from/ }).first().click();
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await page.keyboard.press("Escape");
    await page.goto("/en/cart");

    await expect(page.getByTestId("cart-line")).toHaveCount(1);
    await expect(page.getByTestId("cart-line")).toContainText("White / L");
    const cart = await api<{ items: { quantity: number; variant: { id: number } }[] }>("GET", "/user/cart?market=EG", { token: shopper.token });
    expect(cart.data.items.map((i) => [i.variant.id, i.quantity])).toEqual([[VARIANT, 1]]);
    // The saved-then-removed product is not left in the wishlist.
    const wishlist = await api<{ items: unknown[] }>("GET", "/user/wishlist?market=EG", { token: shopper.token });
    expect(wishlist.data.items).toHaveLength(0);
  });

  test("94 a tab still showing customer A cannot write into customer B's cart after an account switch", async ({ page, context }) => {
    const a = await createShopper("switch-a");
    const b = await createShopper("switch-b");
    await signIn(page, a);
    await page.goto(`/en/products/${TEE}?variant=${VARIANT}`);
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-L")).toBeVisible();

    // Another tab of the same browser: sign out, then sign in as B (the session cookie is now B's).
    const other = await context.newPage();
    await other.goto("/en/account");
    await other.getByRole("main").getByRole("button", { name: "Sign out" }).click();
    await expect(other).toHaveURL(/signed_out=1/);
    await signIn(other, b);
    await expect(other).not.toHaveURL(/\/login/);

    // The stale tab (rendered for A) adds to the cart; wait for the write to be answered before checking.
    const write = page.waitForResponse((r) => r.url().includes("/shop-sync") && r.request().method() === "POST");
    await page.getByTestId("add-to-cart").click();
    await write;
    // It must not land in B's (nor A's) account.
    expect((await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: b.token })).data.items).toHaveLength(0);
    expect((await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: a.token })).data.items).toHaveLength(0);
    // The stale tab reloads into the current session (B), whose cart is empty.
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
  });

  test("93 Add to cart then an immediate reload keeps the item", async ({ page }) => {
    const shopper = await createShopper("cart-reload");
    await signIn(page, shopper);
    await page.goto(`/en/products/${TEE}?variant=${VARIANT}`);
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await page.reload();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    const cart = await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: shopper.token });
    expect(cart.data.items).toHaveLength(1);
  });
});
