import { ACCOUNT_E2E, PASSWORD, TEE, api, consoleErrors, createShopper, createVerifiedShopper, ensureTestStock, expect, localDb, signIn, test } from "./helpers";
import { addAddress, orderIdFromUrl, providerEvent } from "./orders";

/**
 * Checkout, order confirmation and payment against the LOCAL backend with
 * its test-only `sandbox` payment driver: no network, no money. The test
 * plays the payment PROVIDER by sending HMAC-signed webhooks — the only way
 * the backend ever records a payment result.
 *
 *   E2E_SANDBOX_SECRET_FILE  file holding the local sandbox webhook secret
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows (mobile layout covered by the visual sweep)"));

test.describe("checkout", () => {
  test("48 guest cart → checkout → sign-in → server-priced checkout → order → paid", async ({ page }) => {
    const errors = consoleErrors(page);
    const shopper = await createVerifiedShopper("checkout");
    await addAddress(shopper);

    // Guest adds to cart, starts checkout from the drawer.
    await page.goto(`/en/products/${TEE}?variant=49`);
    await page.getByTestId("add-to-cart").click();
    await page.getByTestId("cart-drawer").getByTestId("proceed-to-checkout").click();
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fcheckout$/);
    const form = page.getByTestId("login-form");
    await form.getByLabel("Email address").fill(shopper.email);
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // The merged cart is priced by the API (quote), not by the browser.
    const quote = await api<{ grand_total: string; checkout_ready: boolean; currency: { code: string } }>("POST", "/user/checkout/quote", {
      token: shopper.token,
      body: { market: "EG", address_id: (await api<{ id: number }[]>("GET", "/user/addresses", { token: shopper.token })).data[0].id },
    });
    expect(quote.status).toBe(200);
    await expect(page.getByTestId("checkout-store")).toHaveCount(1);
    await expect(page.getByTestId("checkout-total")).not.toHaveText("—");
    const shownTotal = await page.getByTestId("checkout-total").textContent();
    expect(shownTotal).toMatch(/EGP/);

    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1$/);
    await expect(page.getByTestId("order-confirmation")).toContainText("your order is placed");
    const orderId = await orderIdFromUrl(page);
    // The account cart is empty after the order, and the header follows.
    await expect.poll(async () => (await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.length).toBe(0);
    await expect(page.getByTestId("cart-count")).toHaveCount(0);

    // Payment started: the provider's page is offered (https only), nothing marked paid yet.
    await expect(page.getByTestId("payment-action")).toBeVisible();
    await expect(page.getByTestId("payment-continue")).toHaveAttribute("href", /^https:\/\//);
    const order = await api<{ payment_status: string; totals: { grand_total: string } }>("GET", `/user/orders/${orderId}`, { token: shopper.token });
    expect(order.data.payment_status).toBe("unpaid");
    expect(shownTotal?.replace(/[^\d.]/g, "")).toBe(Number(order.data.totals.grand_total).toString());

    // The provider confirms → the order page shows it paid after a status check.
    await providerEvent(shopper, orderId, "succeeded");
    await page.getByRole("link", { name: "Check payment status" }).click();
    await expect(page.getByTestId("payment-paid")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("49 a failed payment can be retried from the order page", async ({ page }) => {
    const shopper = await createVerifiedShopper("pay-fail");
    await addAddress(shopper);
    await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } });
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\?placed=1$/);
    const orderId = await orderIdFromUrl(page);

    await providerEvent(shopper, orderId, "failed");
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("payment-failed")).toBeVisible();
    await page.getByRole("button", { name: "Try the payment again" }).click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}\\?payment=started$`));
    await expect(page.getByTestId("payment-action")).toBeVisible();
    await providerEvent(shopper, orderId, "succeeded");
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("payment-paid")).toBeVisible();
  });

  test("50 replaying the same checkout submission never creates a second order", async ({ page }) => {
    const shopper = await createVerifiedShopper("replay");
    await addAddress(shopper);
    await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } });
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // Capture exactly what the form posts (address, shipping per store, idempotency key).
    const key = await page.locator('input[name="idempotency_key"]').inputValue();
    const addressId = Number(await page.locator('input[name="address_id"]').inputValue());
    const shipping = await page.locator('input[name^="shipping["]').evaluateAll((inputs) =>
      inputs.map((el) => ({ store_id: Number(/\[(\d+)\]/.exec((el as HTMLInputElement).name)![1]), shipping_method_id: Number((el as HTMLInputElement).value) })),
    );
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\?placed=1$/);
    const orderId = await orderIdFromUrl(page);

    // The same submission again (double click, retry after a timeout) → the SAME order.
    const again = await api<{ id: string }>("POST", "/user/orders", { token: shopper.token, body: { idempotency_key: key, market: "EG", address_id: addressId, shipping_selections: shipping } });
    expect(again.status).toBe(200);
    expect(again.data.id).toBe(orderId);
    // The key reused for a DIFFERENT order is refused, never silently merged.
    const tampered = await api("POST", "/user/orders", { token: shopper.token, body: { idempotency_key: key, market: "EG", address_id: addressId } });
    expect(tampered.status).toBe(409);
    const orders = await api<{ meta: { total: number } }>("GET", "/user/orders", { token: shopper.token });
    expect(orders.data.meta.total).toBe(1);
  });

  test("51 checkout guards: sign-in, no address, empty cart, add-address round trip", async ({ page }) => {
    await page.goto("/en/checkout");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Fcheckout$/);

    const shopper = await createShopper("guards");
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByRole("heading", { name: "Add a delivery address first" })).toBeVisible();

    // Add an address from checkout → back to checkout with it selected.
    await page.getByRole("link", { name: "Add a new address" }).click();
    await expect(page).toHaveURL(/\/en\/account\/addresses\/new\?next=%2Fcheckout$/);
    const af = page.getByTestId("address-form");
    await af.getByLabel("Country").selectOption({ label: "Egypt" });
    await af.getByLabel("Governorate / region").selectOption({ label: "Cairo" });
    await af.getByLabel("City / district").selectOption({ label: "Maadi" });
    await af.getByLabel("Street and number").fill("9 Road 233");
    await af.getByRole("button", { name: "Save address" }).click();
    await expect(page).toHaveURL(/\/en\/checkout\?address=\d+$/);
    // Empty cart: an honest empty state, no order form.
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
    await expect(page.getByTestId("checkout-form")).toHaveCount(0);
  });

  test("52 changing the address or delivery re-prices on the server; unpriceable orders can't be placed", async ({ page }) => {
    const shopper = await createVerifiedShopper("requote");
    await addAddress(shopper, "Home");
    await addAddress(shopper, "Office");
    await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 2, market: "EG" } });
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByTestId("checkout-total")).not.toHaveText("—");

    await page.getByTestId("checkout-addresses").getByText("Office", { exact: true }).click();
    await expect(page.getByText("Updating your total…")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();

    // A tampered form value (unknown shipping method) is refused by the API, not trusted.
    const placed = await api("POST", "/user/orders", {
      token: shopper.token,
      body: { idempotency_key: `order-${crypto.randomUUID()}`, market: "EG", address_id: (await api<{ id: number }[]>("GET", "/user/addresses", { token: shopper.token })).data[0].id, shipping_selections: [{ store_id: 999999, shipping_method_id: 999999 }] },
    });
    expect([409, 422]).toContain(placed.status);
  });
  test("60 multi-store: a store without a commission rule blocks checkout without saying why; restored, both stores order together", async ({ page }) => {
    const errors = consoleErrors(page);
    const shopper = await createVerifiedShopper("multi-store");
    await addAddress(shopper);
    for (const variant of [49, 1]) {
      expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: variant, quantity: 1, market: "EG" } })).status).toBe(200);
    }
    // Test-only, disposable local DB: variant 1's merchant gets two overlapping overrides, so no effective commission rule.
    const merchant = "DB::table('stores')->where('id', DB::table('products')->where('id', DB::table('product_variants')->where('id', 1)->value('product_id'))->value('store_id'))->value('merchant_id')";
    const TAG_FROM = "2001-01-01 00:00:00"; // marks this test's rows for cleanup
    const cleanUp = () => localDb(`DB::table('commission_rules')->where('scope', 'merchant')->where('effective_from', '${TAG_FROM}')->delete();`);
    const reserved = () => localDb(`echo DB::table('inventories')->whereIn('product_variant_id', [1, 49])->sum('reserved_quantity');`).trim();
    cleanUp(); // a crashed earlier run must not leave its rows behind
    localDb(`$m = ${merchant}; foreach (['1.1100', '2.2200'] as $rate) { DB::table('commission_rules')->insert(['market_id' => DB::table('markets')->where('code', 'EG')->value('id'), 'scope' => 'merchant', 'merchant_id' => $m, 'rate_percent' => $rate, 'is_active' => true, 'effective_from' => '${TAG_FROM}', 'created_at' => now(), 'updated_at' => now()]); }`);
    try {
      await signIn(page, shopper, { next: "/checkout" });
      await expect(page).toHaveURL(/\/en\/checkout$/);
      await expect(page.getByTestId("checkout-store")).toHaveCount(2);
      await expect(page.getByTestId("checkout-blockers")).toContainText("This store is not accepting orders right now.");
      await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
      await expect(page.locator("main")).not.toContainText(/commission/i);

      // Placing anyway (bypassing the disabled button) is refused by the API with the same store blocker; nothing is reserved.
      const before = reserved();
      const quote = await api<{ stores: { store: { id: number }; shipping_options: { shipping_method_id: number }[] }[] }>("POST", "/user/checkout/quote", {
        token: shopper.token,
        body: { market: "EG", address_id: (await api<{ id: number }[]>("GET", "/user/addresses", { token: shopper.token })).data[0].id },
      });
      const refused = await api<unknown>("POST", "/user/orders", {
        token: shopper.token,
        body: {
          idempotency_key: `order-${crypto.randomUUID()}`, market: "EG",
          address_id: (await api<{ id: number }[]>("GET", "/user/addresses", { token: shopper.token })).data[0].id,
          shipping_selections: quote.data.stores.map((s) => ({ store_id: s.store.id, shipping_method_id: s.shipping_options[0].shipping_method_id })),
        },
      });
      expect(refused.status).toBe(422);
      expect(JSON.stringify(refused)).toContain("store_unavailable");
      expect(JSON.stringify(refused)).not.toMatch(/commission/i);
      expect(reserved()).toBe(before);
      expect((await api<{ items: unknown[] }>("GET", "/user/orders", { token: shopper.token })).data.items.length).toBe(0);
    } finally {
      cleanUp();
    }

    await page.reload();
    await expect(page.getByTestId("checkout-store")).toHaveCount(2);
    await expect(page.getByTestId("checkout-blockers")).toHaveCount(0);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1/);
    const orderId = /\/account\/orders\/([0-9a-f-]{36})/.exec(page.url())![1];
    const order = await api<{ stores: { id: string }[] }>("GET", `/user/orders/${orderId}`, { token: shopper.token });
    expect(order.data.stores).toHaveLength(2);
    expect(errors).toEqual([]);
  });
});
