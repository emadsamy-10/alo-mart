import { ACCOUNT_E2E, ensureTestStock, TEE, api, consoleErrors, createShopper, expect, signIn, test } from "./helpers";

/**
 * Guest ↔ account transitions for cart and wishlist, product pages for
 * guests and customers, and the account UI in Arabic, dark mode and on
 * mobile — real API, LOCAL backend only.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});

const WHITE_XL = 50;

interface AccountCart {
  items: { quantity: number; variant: { id: number } }[];
}

async function addWhiteXl(page: import("@playwright/test").Page) {
  await page.goto(`/en/products/${TEE}?variant=${WHITE_XL}`);
  await expect(page.getByText("SKU: CL-ESS-TEE-WHT-XL")).toBeVisible();
  await page.getByTestId("add-to-cart").click();
  await expect(page.getByTestId("cart-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe("cart and wishlist across sign-in", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

  test("39 guest cart and wishlist move into the account at sign-in; sign-out leaves nothing", async ({ page }) => {
    const errors = consoleErrors(page);
    const shopper = await createShopper("merge");
    await addWhiteXl(page);
    await page.getByRole("button", { name: /^Save .* to wishlist$/ }).first().click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");

    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    await expect.poll(async () => (await api<AccountCart>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.map((i) => [i.variant.id, i.quantity])).toEqual([[WHITE_XL, 1]]);
    await expect.poll(async () => (await api<{ items_count: number }>("GET", "/user/wishlist?market=EG", { token: shopper.token })).data.items_count).toBe(1);
    // Moved, not copied: the guest storage on this device is empty now.
    await expect.poll(() => page.evaluate(() => [localStorage.getItem("alo_cart_v1"), localStorage.getItem("alo_wishlist_v1")])).toEqual([null, null]);
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");

    await page.reload();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");

    await page.getByTestId("sign-out").first().click();
    await expect(page).toHaveURL(/signed_out=1/);
    await expect(page.getByTestId("cart-count")).toHaveCount(0);
    await expect(page.getByTestId("wishlist-count")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("40 signed in: cart changes go to the account and follow the customer to another device", async ({ page, browser }) => {
    const shopper = await createShopper("acct-cart");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    await addWhiteXl(page);
    await expect.poll(async () => (await api<AccountCart>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items[0]?.quantity).toBe(1);

    await page.getByTestId("cart-button").locator("visible=true").click();
    const drawer = page.getByTestId("cart-drawer");
    await drawer.getByRole("button", { name: "Increase quantity" }).click();
    await expect(drawer.getByTestId("cart-line-qty")).toHaveText("2");
    await expect.poll(async () => (await api<AccountCart>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items[0]?.quantity).toBe(2);
    // Nothing account-specific was written to this browser's storage.
    expect(await page.evaluate(() => localStorage.getItem("alo_cart_v1"))).toBeNull();

    const laptop = await browser.newContext();
    const other = await laptop.newPage();
    await signIn(other, shopper);
    await expect(other).toHaveURL(/\/en\/account$/);
    await expect(other.getByTestId("cart-count").first()).toHaveText("2");
    await laptop.close();

    await drawer.getByRole("button", { name: /^Remove / }).click();
    await expect.poll(async () => (await api<AccountCart>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.length).toBe(0);
  });

  test("41 signed in: saving and unsaving a product updates the account wishlist", async ({ page }) => {
    const shopper = await createShopper("acct-wish");
    await signIn(page, shopper);
    await page.goto(`/en/products/${TEE}`);
    const save = page.getByRole("button", { name: /to wishlist$/ }).first();
    await save.click();
    await expect(page.getByRole("button", { name: /from wishlist$/ }).first()).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await api<{ items_count: number }>("GET", "/user/wishlist?market=EG", { token: shopper.token })).data.items_count).toBe(1);
    await page.goto("/en/wishlist");
    await expect(page.getByText(/Essential Crew-Neck/).first()).toBeVisible();
    await page.getByRole("button", { name: /^Remove / }).first().click();
    await expect.poll(async () => (await api<{ items_count: number }>("GET", "/user/wishlist?market=EG", { token: shopper.token })).data.items_count).toBe(0);
  });
});

test.describe("signed-in lists load without a false empty state", () => {
  test("84 cart and wishlist pages wait for the account instead of flashing 'empty', and say they are the account's", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "the cart page's layout shift was measured on phones; the logic is the same everywhere");
    const shopper = await createShopper("no-flash");
    const product = await api<{ id: number }>("GET", `/products/${TEE}?market=EG`);
    expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } })).status).toBe(200);
    expect((await api("POST", "/user/wishlist/items", { token: shopper.token, body: { product_id: product.data.id, market: "EG" } })).status).toBeLessThan(300);
    await signIn(page, shopper);
    // Record every empty-state text that is ever rendered, however briefly.
    await page.addInitScript(() => {
      const w = window as unknown as { __empty: string[]; __cls: number };
      w.__empty = [];
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new MutationObserver(() => {
        for (const text of ["Your cart is empty", "No saved products yet"]) if (document.body?.innerText.includes(text) && !w.__empty.includes(text)) w.__empty.push(text);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    for (const [path, line] of [["/en/cart", "cart-line"], ["/en/wishlist", "wishlist-item"]] as const) {
      await page.goto(path);
      await expect(page.getByTestId(line).first()).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { __empty: string[] }).__empty), path).toEqual([]);
      await page.waitForTimeout(500);
      // The space is reserved while the account loads: no "poor" layout shift (Web Vitals: good < 0.1).
      expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls), `${path} layout shift`).toBeLessThan(0.1);
    }
    // A signed-in cart is the account's, not this browser's.
    await page.goto("/en/cart");
    await expect(page.getByText("This cart is saved to your account.")).toBeVisible();
    await expect(page.getByText("saved in this browser")).toHaveCount(0);
  });
});

test.describe("product details", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

  test("42 guests browse product pages freely; header sign-in returns to the same ?variant=", async ({ page }) => {
    const shopper = await createShopper("pdp");
    await page.goto(`/en/products/${TEE}?variant=${WHITE_XL}`);
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-XL")).toBeVisible();
    await expect(page.getByTestId("add-to-cart")).toBeEnabled();
    await page.getByTestId("header-sign-in").click();
    await expect(page).toHaveURL(new RegExp(`/en/login\\?next=%2Fproducts%2F${TEE}%3Fvariant%3D${WHITE_XL}$`));
    const form = page.getByTestId("login-form");
    await form.getByLabel("Email address").fill(shopper.email);
    await form.getByLabel("Password", { exact: true }).fill(shopper.password);
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/en/products/${TEE}\\?variant=${WHITE_XL}$`));
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-XL")).toBeVisible();
    await expect(page.getByTestId("account-menu")).toBeVisible();
  });

  test("43 signed-in product pages keep public SEO and the same variant behaviour", async ({ page }) => {
    const shopper = await createShopper("pdp-seo");
    await signIn(page, shopper);
    await page.goto(`/en/products/${TEE}?variant=49`);
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-L")).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/en/products/${TEE}$`));
    await page.getByRole("radio", { name: "XL" }).click();
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-XL")).toBeVisible();
  });
});

test.describe("navigation, language, theme and small screens", () => {
  test("44 account menu lists every section and signs out from anywhere (desktop)", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    const shopper = await createShopper("menu");
    await signIn(page, shopper);
    await page.goto("/en/products");
    await page.getByTestId("account-menu").click();
    const menu = page.getByRole("menu");
    for (const name of ["Overview", "Orders", "Addresses", "Profile", "Security"]) await expect(menu.getByRole("menuitem", { name })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Addresses" }).click();
    await expect(page).toHaveURL(/\/en\/account\/addresses$/);
    await expect(page.getByRole("link", { name: "Addresses", exact: true }).first()).toHaveAttribute("aria-current", "page");
  });

  test("45 mobile: the menu drawer offers sign-in, then the account and sign-out", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile");
    const shopper = await createShopper("mobile");
    await page.goto("/en");
    await page.getByRole("button", { name: "Open menu" }).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByTestId("mobile-account").getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    // No horizontal overflow on any account page (innerWidth grows with overflow on mobile, so compare to clientWidth).
    for (const path of ["/en/account", "/en/account/orders", "/en/account/addresses", "/en/account/addresses/new", "/en/account/profile", "/en/account/security"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        // Name what sticks out (a scrolling strip's own items are fine: they are clipped by their scroller).
        const culprits = [...document.querySelectorAll("body *")]
          .filter((el) => !(el instanceof SVGElement) && el.getBoundingClientRect().right > limit + 1 && !el.closest("[data-scroll-strip]"))
          .map((el) => `${el.tagName}.${String(el.className).split(" ").slice(0, 4).join(".")} "${(el.textContent ?? "").trim().slice(0, 30)}"`)
          .slice(0, 5);
        return { px: document.documentElement.scrollWidth - limit, culprits };
      });
      expect(overflow.px, `${path}: ${overflow.culprits.join(" | ")}`).toBeLessThanOrEqual(0);
    }
    await page.goto("/en/account");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("dialog").getByText("Hello, Mona")).toBeVisible();
    await page.getByRole("dialog").getByTestId("sign-out").click();
    await expect(page).toHaveURL(/signed_out=1/);
  });

  test("46 Arabic: right-to-left forms with Arabic labels and Arabic API errors", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.goto("/ar/register");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 1, name: "إنشاء حساب" })).toBeVisible();
    const form = page.getByTestId("register-form");
    await form.getByLabel("البريد الإلكتروني").fill("not-an-email");
    await form.getByRole("button", { name: "إنشاء الحساب" }).click();
    await expect(form.getByLabel("البريد الإلكتروني")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("alert").first()).toContainText("يُرجى مراجعة الحقول المميّزة.");
    await expect(form.locator('[id$="-error"]').first()).toHaveText(/[؀-ۿ]/);
    // Phone numbers stay left-to-right inside the RTL form.
    await expect(form.getByLabel("رقم الجوال")).toHaveAttribute("dir", "ltr");
  });

  test("47 dark mode and keyboard: forms are themed and fully operable without a mouse", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop");
    await page.emulateMedia({ colorScheme: "dark" });
    const shopper = await createShopper("keyboard");
    await page.goto("/en/login");
    await expect(page.locator("html")).toHaveClass(/dark/);
    const bg = await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgb(255, 255, 255)");

    const form = page.getByTestId("login-form");
    await form.getByLabel("Email address").focus();
    await page.keyboard.type(shopper.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(shopper.password);
    await page.keyboard.press("Tab");
    await expect(form.getByRole("button", { name: "Show password" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
    await form.getByLabel("Password", { exact: true }).press("Enter");
    await expect(page).toHaveURL(/\/en\/account$/);
  });
});
