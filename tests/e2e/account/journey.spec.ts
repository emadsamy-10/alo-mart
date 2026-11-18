import fs from "node:fs";
import { ACCOUNT_API, ACCOUNT_E2E, PASSWORD, TEE, api, consoleErrors, createVerifiedShopper, ensureTestStock, expect, formAlert, localDb, sessionCookie, signIn, test, type Shopper } from "./helpers";
import { addAddress, orderIdFromUrl, providerEvent } from "./orders";

/**
 * The whole customer journey against the REAL local backend (disposable
 * database, log mail transport, sandbox payment driver), through the real UI:
 * sign in → browse and filter → product → cart → checkout → order → paid. No API
 * response is mocked. `localDb` only READS here, to prove order and stock data
 * from the source of truth. The payment result arrives the only way it can: a
 * signed provider webhook.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});

const VARIANT = 49; // Cotton Lane tee, White / L
const EVIDENCE = process.env.E2E_EVIDENCE_DIR;

/** The JSON the last line of a tinker `echo json_encode(...)` printed. */
function dbRead<T>(php: string): T {
  const lines = localDb(`echo json_encode(${php});`).trim().split(/\r?\n/);
  return JSON.parse(lines[lines.length - 1]) as T;
}
const userId = (email: string) => `DB::table('users')->where('email', '${email}')->value('id')`;
const orderCount = (email: string) => dbRead<number>(`DB::table('orders')->where('user_id', ${userId(email)})->count()`);
const stock = (variant: number) => dbRead<{ on_hand_quantity: number; reserved_quantity: number }>(`DB::table('inventories')->where('product_variant_id', ${variant})->first(['on_hand_quantity', 'reserved_quantity'])`);
/** Holds left lapsed by earlier orders expire lazily on the next placement; clear them so stock arithmetic is exact. */
const expireLapsedHolds = () => localDb(`Illuminate\\Support\\Facades\\Artisan::call('inventory:expire-reservations');`);
const digits = (text: string | null) => Number((text ?? "").replace(/[^\d.]/g, "").replace(/^\.+|\.+$/g, ""));

const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (EVIDENCE) await page.screenshot({ path: `${EVIDENCE}/${name}.png`, fullPage: false });
};

async function settled(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("catalog-results")).not.toHaveAttribute("aria-busy", "true", { timeout: 30_000 });
  await expect(page.getByTestId("result-count")).not.toContainText("Updating", { timeout: 30_000 });
}
const shownTotal = async (page: import("@playwright/test").Page) => {
  await settled(page);
  return Number(((await page.getByTestId("result-count").textContent()) ?? "").replace(/[^\d]/g, ""));
};
const listingTotal = async (query: string) => (await api<{ meta: { total: number } }>("GET", `/products?market=EG&per_page=1${query}`)).data.meta.total;

test.describe("login → order confirmation", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "the full journey runs on desktop; phones run the localized journey below"));

  test("70 a real customer signs in, finds a product, pays in the sandbox and sees a correct order", async ({ page }) => {
    test.setTimeout(240_000);
    const errors = consoleErrors(page);
    const shopper = await createVerifiedShopper("journey", { name: "Journey Customer" });

    // ── FLOW 1: authentication ──────────────────────────────────────────────
    await page.goto("/en");
    await page.getByTestId("header-sign-in").click();
    await expect(page).toHaveURL(/\/en\/login/);
    const login = page.getByTestId("login-form");
    await login.getByLabel("Email address").fill(shopper.email);
    await login.getByLabel("Password", { exact: true }).fill("wrong-password-1");
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(formAlert(page)).toHaveText("The email address or password is not correct.");
    expect(await sessionCookie(page)).toBeUndefined();
    await login.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await login.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Journey");
    expect(await sessionCookie(page)).toBeDefined();
    await page.reload();
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Journey");
    await page.goto("/en/account/profile");
    await expect(page.getByLabel("Full name")).toHaveValue("Journey Customer");
    await expect(page.locator("main")).toContainText(shopper.email);
    await shot(page, "01-signed-in");

    // ── FLOW 2: discovery from the new navbar ───────────────────────────────
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "All products", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/products$/);
    expect(await shownTotal(page)).toBe(await listingTotal(""));

    const sidebar = page.getByRole("complementary");
    await sidebar.getByTestId("filter-category-fashion").click();
    await expect(page).toHaveURL(/category=fashion/);
    await settled(page);
    await page.getByTestId("sort-select").click();
    await page.getByRole("option", { name: "Price: low to high" }).click();
    await expect(page).toHaveURL(/sort=price_asc/);
    await settled(page);
    await sidebar.getByTestId("filter-brand-cotton-lane").click();
    await expect(page).toHaveURL(/brand=cotton-lane/);
    await settled(page);
    await sidebar.getByLabel("From", { exact: true }).fill("400");
    await sidebar.getByLabel("To", { exact: true }).fill("500");
    await sidebar.getByRole("button", { name: "Apply price" }).click();
    await expect(page).toHaveURL(/min=400&max=500/);
    await settled(page);
    await sidebar.getByTestId("filter-attr-color-white").click();
    await expect(page).toHaveURL(/attr\.color=white/);
    const filteredUrl = page.url();
    const expected = await listingTotal("&category_id[]=18&include_descendants=1&brand_id[]=9&min_price=400&max_price=500&attr[color]=white&sort=price_asc");
    expect(expected).toBe(1);
    expect(await shownTotal(page)).toBe(expected);
    await expect(page.getByTestId("filter-chip")).not.toHaveCount(0);
    await shot(page, "02-filtered-catalog");

    // The whole state survives refresh and Back/Forward.
    await page.reload();
    expect(await shownTotal(page)).toBe(expected);
    await expect(sidebar.getByTestId("filter-brand-cotton-lane").getByRole("checkbox")).toBeChecked();
    await page.goBack();
    await expect(page).not.toHaveURL(filteredUrl);
    await settled(page);
    await page.goForward();
    await expect(page).toHaveURL(filteredUrl);
    expect(await shownTotal(page)).toBe(expected);

    // Pagination on the plain listing, in its own history entry.
    await page.goto("/en/products");
    await page.getByTestId("pagination").getByRole("link", { name: "Go to page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await settled(page);
    await page.goto(filteredUrl);
    await settled(page);

    // ── FLOW 3: product details ─────────────────────────────────────────────
    await page.getByTestId("catalog-grid").getByRole("link", { name: /Essential Crew-Neck T-Shirt/ }).click();
    await expect(page).toHaveURL(new RegExp(`/en/products/${TEE}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Essential Crew-Neck T-Shirt");
    const thumbs = page.getByTestId("gallery-thumb");
    await thumbs.nth(1).click();
    await expect(thumbs.nth(1)).toHaveAttribute("aria-current", "true");
    await page.getByRole("button", { name: /in full screen/ }).click();
    const viewer = page.getByRole("dialog");
    await viewer.getByRole("button", { name: "Zoom in" }).click();
    await expect(viewer.getByTestId("lightbox-viewport")).toHaveAttribute("data-zoom", "2");
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();

    await page.getByRole("radio", { name: "White" }).click();
    await page.getByRole("radio", { name: "L", exact: true }).click();
    await expect(page.getByText("SKU: CL-ESS-TEE-WHT-L")).toBeVisible();
    const detail = await api<{ variants: { id: number; price: string; is_in_stock: boolean }[] }>("GET", `/products/${TEE}?market=EG`);
    const apiVariant = detail.data.variants.find((v) => v.id === VARIANT)!;
    expect(apiVariant.is_in_stock).toBe(true);
    const unitPrice = Number(apiVariant.price);
    expect(digits(await page.getByTestId("pdp-price").textContent())).toBe(unitPrice);

    await page.getByRole("button", { name: /^Save / }).first().click();
    await expect(page.getByTestId("wishlist-count")).toHaveText("1");
    await page.getByRole("button", { name: /^Remove .* from/ }).first().click();
    await expect(page.getByTestId("wishlist-count")).toHaveCount(0);

    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await expect(page.getByTestId("cart-drawer")).toBeVisible();
    await shot(page, "03-added-to-cart");
    await page.keyboard.press("Escape");

    // ── FLOW 4: cart ────────────────────────────────────────────────────────
    await page.goto("/en/cart");
    const line = page.getByTestId("cart-line");
    await expect(line).toHaveCount(1);
    await expect(line).toContainText("Essential Crew-Neck T-Shirt");
    await expect(line).toContainText("White / L");
    await line.getByRole("button", { name: "Increase quantity" }).click();
    await line.getByRole("button", { name: "Increase quantity" }).click();
    await expect(line.getByTestId("cart-line-qty")).toHaveText("3");
    await expect.poll(async () => digits(await page.getByTestId("cart-subtotal").textContent())).toBe(unitPrice * 3);
    await line.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(line.getByTestId("cart-line-qty")).toHaveText("2");
    await expect.poll(async () => digits(await page.getByTestId("cart-subtotal").textContent())).toBe(unitPrice * 2);
    // The account cart on the server is what will be priced.
    await expect
      .poll(async () => (await api<{ items: { quantity: number }[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.map((i) => i.quantity))
      .toEqual([2]);
    await page.reload();
    await expect(line.getByTestId("cart-line-qty")).toHaveText("2");
    await expect(page.getByTestId("cart-count").first()).toHaveText("2");
    await shot(page, "04-cart");

    // ── FLOW 5: checkout ────────────────────────────────────────────────────
    await page.getByRole("link", { name: /checkout/i }).first().click();
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByTestId("checkout-verify-email")).toHaveCount(0); // verified
    await expect(page.getByRole("heading", { name: "Add a delivery address first" })).toBeVisible();
    await page.getByRole("link", { name: "Add a new address" }).click();
    const form = page.getByTestId("address-form");
    await expect(form.getByLabel("City / district")).toBeDisabled();
    await form.getByLabel("Country").selectOption({ label: "Egypt" });
    await form.getByLabel("Governorate / region").selectOption({ label: "Giza" });
    await expect(form.getByLabel("City / district").locator("option")).toContainText(["Dokki"]);
    await form.getByLabel("City / district").selectOption({ label: "Dokki" });
    await form.getByLabel("Street and number").fill("7 Journey Street");
    await form.getByRole("button", { name: "Save address" }).click();
    await expect(page).toHaveURL(/\/en\/checkout\?address=\d+$/);
    await expect(page.getByTestId("checkout-store")).toHaveCount(1);
    await expect(page.getByTestId("checkout-total")).not.toHaveText("—");

    const addressId = (await api<{ id: number }[]>("GET", "/user/addresses", { token: shopper.token })).data[0].id;
    const first = await api<{ stores: { store: { id: number }; shipping_options: { shipping_method_id: number; fee: string }[] }[] }>("POST", "/user/checkout/quote", {
      token: shopper.token,
      body: { market: "EG", address_id: addressId },
    });
    const selections = first.data.stores.map((s) => ({ store_id: s.store.id, shipping_method_id: s.shipping_options[0].shipping_method_id }));
    const quote = await api<{ checkout_ready: boolean; commercial_subtotal: string; shipping_total: string; tax_total: string; grand_total: string; blockers: unknown[] }>("POST", "/user/checkout/quote", {
      token: shopper.token,
      body: { market: "EG", address_id: addressId, shipping_selections: selections },
    });
    expect(quote.data.checkout_ready, "ready means shipping, tax and commission are all configured").toBe(true);
    expect(Number(quote.data.commercial_subtotal)).toBe(unitPrice * 2);
    expect(Number(quote.data.shipping_total)).toBeGreaterThan(0);
    expect(Number(quote.data.tax_total)).toBeGreaterThan(0);
    const totals = page.getByTestId("checkout-totals");
    expect(digits(await page.getByTestId("checkout-total").textContent())).toBe(Number(quote.data.grand_total));
    await expect(totals).toContainText(Number(unitPrice * 2).toLocaleString("en"));
    await expect(page.getByTestId("checkout-payment")).toContainText("Card (sandbox)");
    await shot(page, "05-checkout");

    expireLapsedHolds();
    const stockBefore = stock(VARIANT);
    expect(orderCount(shopper.email)).toBe(0);

    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1$/);
    await expect(page.getByTestId("order-confirmation")).toContainText("your order is placed");
    // Unpaid here, so the banner must not call it confirmed.
    await expect(page.getByTestId("order-confirmation")).not.toContainText("confirmed");
    const orderId = await orderIdFromUrl(page);
    await shot(page, "06-order-confirmation");

    // ── FLOW 6: order verification, from the API and the database ───────────
    type Order = {
      id: string;
      order_number: string;
      status: string;
      payment_status: string;
      payment_due_at: string;
      quantity_count: number;
      totals: { merchandise_gross: string; shipping_gross: string; grand_total: string };
      delivery_address: { address_line_1: string; country: { code: string }; region: { name: string }; city: { name: string } };
      stores: { items: { variant: { id: number; sku: string }; quantity: number; unit_price: string; line_gross: string }[] }[];
    };
    const order = (await api<Order>("GET", `/user/orders/${orderId}`, { token: shopper.token })).data;
    expect(orderCount(shopper.email), "exactly one order").toBe(1);
    expect([order.status, order.payment_status]).toEqual(["placed", "unpaid"]);
    expect(order.payment_due_at).toBeTruthy();
    expect(order.quantity_count).toBe(2);
    const item = order.stores[0].items[0];
    expect([item.variant.id, item.variant.sku, item.quantity, Number(item.unit_price)]).toEqual([VARIANT, "CL-ESS-TEE-WHT-L", 2, unitPrice]);
    expect(Number(order.totals.grand_total)).toBe(Number(quote.data.grand_total));
    expect([order.delivery_address.address_line_1, order.delivery_address.country.code, order.delivery_address.region.name, order.delivery_address.city.name]).toEqual(["7 Journey Street", "EG", "Giza", "Dokki"]);

    // Stock is RESERVED for the unpaid order: reserved +2, nothing has left the shelf.
    const held = stock(VARIANT);
    expect([held.on_hand_quantity, held.reserved_quantity]).toEqual([stockBefore.on_hand_quantity, stockBefore.reserved_quantity + 2]);
    const reservations = dbRead<{ status: string; quantity: number; expires_at: string | null }[]>(
      `DB::table('inventory_reservations')->where('batch_id', DB::table('orders')->where('uuid', '${orderId}')->value('inventory_reservation_batch_id'))->get(['status', 'quantity', 'expires_at'])`,
    );
    expect(reservations.map((r) => [r.status, r.quantity])).toEqual([["active", 2]]);
    expect(reservations[0].expires_at).toBeTruthy();
    // The account cart was emptied by the order.
    await expect.poll(async () => (await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.length).toBe(0);
    await expect(page.getByTestId("cart-count")).toHaveCount(0);

    await page.goto("/en/account/orders");
    await expect(page.getByTestId("orders").locator("li")).toHaveCount(1);
    await page.getByRole("link", { name: new RegExp(order.order_number) }).click();
    await expect(page).toHaveURL(new RegExp(`/en/account/orders/${orderId}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`#${order.order_number}`);
    await expect(page.getByText("White / L")).toBeVisible();
    await expect(page.getByText("7 Journey Street")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`#${order.order_number}`);
    await expect(page.getByText("7 Journey Street")).toBeVisible();

    // Sandbox payment: started from the order page; only a signed provider event can confirm it.
    await page.goto(`/en/account/orders/${orderId}?placed=1`);
    await expect(page.getByTestId("payment-action")).toBeVisible();
    await expect(page.getByTestId("payment-continue")).toHaveAttribute("href", /^https:\/\//);
    expect((await api<Order>("GET", `/user/orders/${orderId}`, { token: shopper.token })).data.payment_status).toBe("unpaid");
    expect(await providerEvent(shopper, orderId, "succeeded")).toBe("captured");
    await page.getByRole("link", { name: "Check payment status" }).click();
    await expect(page.getByTestId("payment-paid")).toBeVisible();
    await shot(page, "07-paid");

    const paid = (await api<Order>("GET", `/user/orders/${orderId}`, { token: shopper.token })).data;
    expect([paid.status, paid.payment_status]).toEqual(["confirmed", "paid"]);
    expect(orderCount(shopper.email), "payment created no second order").toBe(1);
    // Paying consumes the hold: both counters drop by 2, available stock is unchanged since placement.
    const after = stock(VARIANT);
    expect([after.on_hand_quantity, after.reserved_quantity]).toEqual([held.on_hand_quantity - 2, held.reserved_quantity - 2]);

    const evidence = { orderId, orderNumber: order.order_number, status: paid.status, paymentStatus: paid.payment_status, grandTotal: order.totals.grand_total, stockBefore, held, after, reservations };
    console.log(`JOURNEY_EVIDENCE ${JSON.stringify(evidence)}`);
    if (EVIDENCE) fs.writeFileSync(`${EVIDENCE}/order-evidence.json`, JSON.stringify(evidence, null, 2));

    // Logout closes the account: protected pages ask to sign in again.
    await page.getByTestId("account-menu").click();
    await page.getByRole("menu").getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByTestId("header-sign-in")).toBeVisible();
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
    expect((await fetch(`${ACCOUNT_API}/user/orders/${orderId}`, { headers: { Accept: "application/json" } })).status).toBe(401);
    expect(errors).toEqual([]);
  });
});

/** The essential journey per language, device and theme, on real endpoints. */
const JOURNEYS = [
  { id: "71", name: "Arabic RTL, desktop, dark", project: "desktop", locale: "ar", theme: "dark", place: "تأكيد الطلب", placed: /تم استلام طلبك/ },
  { id: "72", name: "Arabic RTL, phone, light", project: "mobile", locale: "ar", theme: "light", place: "تأكيد الطلب", placed: /تم استلام طلبك/ },
  { id: "73", name: "English LTR, phone, dark", project: "mobile", locale: "en", theme: "dark", place: "Place order", placed: /your order is placed/ },
] as const;

for (const journey of JOURNEYS) {
  test(`${journey.id} essential journey: ${journey.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== journey.project, `runs on ${journey.project}`);
    test.setTimeout(150_000);
    const errors = consoleErrors(page);
    await page.addInitScript((theme) => localStorage.setItem("alo-theme", theme), journey.theme);
    const shopper: Shopper = await createVerifiedShopper(`journey-${journey.id}`);
    await addAddress(shopper);

    await signIn(page, shopper, { locale: journey.locale });
    await expect(page.locator("html")).toHaveAttribute("dir", journey.locale === "ar" ? "rtl" : "ltr");
    await expect(page.locator("html")).toHaveClass(journey.theme === "dark" ? /dark/ : /^(?!.*\bdark\b)/);

    await page.goto(`/${journey.locale}/products/${TEE}?variant=${VARIANT}`);
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByTestId("cart-count").first()).toHaveText("1");
    await page.getByTestId("cart-drawer").getByTestId("proceed-to-checkout").click();
    await expect(page).toHaveURL(new RegExp(`/${journey.locale}/checkout$`));
    await expect(page.getByTestId("checkout-total")).not.toHaveText("—");
    await expect(page.getByRole("button", { name: journey.place })).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no horizontal overflow at checkout").toBeLessThanOrEqual(0);
    await shot(page, `journey-${journey.id}-checkout`);

    await page.getByRole("button", { name: journey.place }).click();
    await expect(page).toHaveURL(new RegExp(`/${journey.locale}/account/orders/[0-9a-f-]{36}\\?placed=1$`));
    await expect(page.getByTestId("order-confirmation")).toContainText(journey.placed);
    await shot(page, `journey-${journey.id}-confirmation`);
    const orderId = await orderIdFromUrl(page);
    expect(orderCount(shopper.email)).toBe(1);
    expect(await providerEvent(shopper, orderId, "succeeded")).toBe("captured");
    await page.reload();
    await expect(page.getByTestId("payment-paid")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

/**
 * Failures not already proven elsewhere (unverified email: 58, 59; empty cart:
 * 51; missing commission: 60; expired payment: 55; failed payment: 49; API
 * outage: 53; another customer's order: 38). Test-only DB changes are restored
 * in `finally`. Nothing here may create an order or hold stock.
 */
test.describe("critical failures create no order and hold no stock", () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

  async function ready(tag: string, quantity = 1) {
    expireLapsedHolds();
    const shopper = await createVerifiedShopper(tag);
    const addressId = await addAddress(shopper);
    expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: VARIANT, quantity, market: "EG" } })).status).toBe(200);
    return { shopper, addressId };
  }
  const placeViaApi = async (shopper: Shopper, addressId: number, key = `order-${crypto.randomUUID()}`) => {
    const first = await api<{ stores: { store: { id: number }; shipping_options: { shipping_method_id: number }[] }[] }>("POST", "/user/checkout/quote", { token: shopper.token, body: { market: "EG", address_id: addressId } });
    return api<{ id: string }>("POST", "/user/orders", {
      token: shopper.token,
      body: { idempotency_key: key, market: "EG", address_id: addressId, shipping_selections: first.data.stores.map((s) => ({ store_id: s.store.id, shipping_method_id: s.shipping_options[0]?.shipping_method_id ?? 0 })) },
    });
  };

  test("74 a product that goes out of stock blocks checkout and the API refuses it", async ({ page }) => {
    const { shopper, addressId } = await ready("oos");
    const before = stock(VARIANT);
    localDb(`DB::table('inventories')->where('product_variant_id', ${VARIANT})->update(['on_hand_quantity' => DB::raw('reserved_quantity')]);`);
    try {
      await signIn(page, shopper, { next: "/checkout" });
      await expect(page).toHaveURL(/\/en\/checkout$/);
      await expect(page.getByTestId("checkout-blockers")).toBeVisible();
      await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
      const refused = await placeViaApi(shopper, addressId);
      expect(refused.status).toBe(422);
      expect(orderCount(shopper.email)).toBe(0);
      expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity);
    } finally {
      ensureTestStock();
    }
  });

  test("75 invalid quantities are refused; the product page clamps what can be typed", async ({ page }) => {
    const shopper = await createVerifiedShopper("qty");
    for (const quantity of [0, -1, 1.5, 100000]) {
      const res = await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: VARIANT, quantity, market: "EG" } });
      expect(res.status, `quantity ${quantity}`).toBe(422);
    }
    expect((await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.length).toBe(0);

    await page.goto(`/en/products/${TEE}?variant=${VARIANT}`);
    await page.getByTestId("pdp-quantity").fill("100000");
    await page.getByTestId("pdp-quantity").blur();
    await expect(page.getByTestId("pdp-quantity")).toHaveValue("99");
    await page.getByTestId("pdp-quantity").fill("0");
    await page.getByTestId("pdp-quantity").blur();
    await expect(page.getByTestId("pdp-quantity")).toHaveValue("1");
  });

  test("76 an invalid address is refused: mismatched places, another customer's address", async () => {
    const { shopper, addressId } = await ready("bad-addr");
    const other = await createVerifiedShopper("bad-addr-other");
    const cairo = (await api<{ id: number; name: string }[]>("GET", "/countries/1/regions")).data.find((r) => r.name === "Cairo")!;
    const giza = (await api<{ id: number; name: string }[]>("GET", "/countries/1/regions")).data.find((r) => r.name === "Giza")!;
    const gizaCity = (await api<{ id: number }[]>("GET", `/regions/${giza.id}/cities`)).data[0];
    const mismatched = await api("POST", "/user/addresses", {
      token: shopper.token,
      body: { recipient_name: "X Y", recipient_phone: shopper.phone, country_id: 1, region_id: cairo.id, city_id: gizaCity.id, address_line_1: "1 Nowhere" },
    });
    expect(mismatched.status).toBe(422);
    // Someone else's address is simply not found, at quote and at placement.
    const otherQuote = await api("POST", "/user/checkout/quote", { token: other.token, body: { market: "EG", address_id: addressId } });
    expect(otherQuote.status).toBe(404);
    const otherPlace = await api("POST", "/user/orders", { token: other.token, body: { idempotency_key: `order-${crypto.randomUUID()}`, market: "EG", address_id: addressId, shipping_selections: [] } });
    expect(otherPlace.status).toBe(404);
    expect(orderCount(other.email)).toBe(0);
  });

  test("77 an area the store does not deliver to blocks checkout", async ({ page }) => {
    const { shopper, addressId } = await ready("no-delivery");
    const store = `DB::table('products')->where('id', DB::table('product_variants')->where('id', ${VARIANT})->value('product_id'))->value('store_id')`;
    const zones = dbRead<number[]>(`DB::table('store_delivery_zones')->where('store_id', ${store})->where('is_active', true)->pluck('id')`);
    expect(zones.length).toBeGreaterThan(0);
    const before = stock(VARIANT);
    localDb(`DB::table('store_delivery_zones')->whereIn('id', [${zones.join(",")}])->update(['is_active' => false]);`);
    try {
      await signIn(page, shopper, { next: "/checkout" });
      await expect(page).toHaveURL(/\/en\/checkout$/);
      await expect(page.getByTestId("checkout-store")).toContainText("does not deliver");
      await expect(page.getByRole("button", { name: "Place order" })).toBeDisabled();
      expect((await placeViaApi(shopper, addressId)).status).toBe(422);
      expect(orderCount(shopper.email)).toBe(0);
      expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity);
    } finally {
      localDb(`DB::table('store_delivery_zones')->whereIn('id', [${zones.join(",")}])->update(['is_active' => true]);`);
    }
  });

  test("78 double-clicking Place order creates exactly one order and one hold", async ({ page }) => {
    const { shopper } = await ready("double");
    const before = stock(VARIANT);
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
    await page.getByRole("button", { name: "Place order" }).dblclick();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1$/);
    expect(orderCount(shopper.email)).toBe(1);
    expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity + 1);
  });

  test("79 an idempotent retry returns the same order; a changed retry is refused", async () => {
    const { shopper, addressId } = await ready("retry");
    const before = stock(VARIANT);
    const key = `order-${crypto.randomUUID()}`;
    const first = await placeViaApi(shopper, addressId, key);
    expect(first.status, first.message).toBe(201);
    const quoteStores = dbRead<number>(`DB::table('store_orders')->where('order_id', DB::table('orders')->where('uuid', '${first.data.id}')->value('id'))->count()`);
    expect(quoteStores).toBe(1);
    const stored = dbRead<{ store_id: number; shipping_method_id: number }>(`DB::table('store_orders')->where('order_id', DB::table('orders')->where('uuid', '${first.data.id}')->value('id'))->first(['store_id', 'shipping_method_id'])`);
    const body = { idempotency_key: key, market: "EG", address_id: addressId, shipping_selections: [{ store_id: stored.store_id, shipping_method_id: stored.shipping_method_id }] };
    const replay = await api<{ id: string }>("POST", "/user/orders", { token: shopper.token, body });
    expect(replay.status, replay.message).toBe(200);
    expect(replay.data.id).toBe(first.data.id);
    const changed = await api("POST", "/user/orders", { token: shopper.token, body: { ...body, address_id: await addAddress(shopper, "Office") } });
    expect(changed.status).toBe(409);
    expect(orderCount(shopper.email)).toBe(1);
    expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity + 1);
  });

  test("80 refreshing during checkout keeps the cart and places nothing", async ({ page }) => {
    const { shopper } = await ready("refresh", 2);
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByTestId("checkout-total")).not.toHaveText("—");
    const total = await page.getByTestId("checkout-total").textContent();
    await page.reload();
    await expect(page.getByTestId("checkout-total")).toHaveText(total!);
    expect((await api<{ items: { quantity: number }[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.map((i) => i.quantity)).toEqual([2]);
    expect(orderCount(shopper.email)).toBe(0);
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\?placed=1$/);
    expect(orderCount(shopper.email)).toBe(1);
  });

  const isOrderSubmit = (request: import("@playwright/test").Request) =>
    request.method() === "POST" && !!request.headers()["next-action"] && (request.headers()["content-type"] ?? "").startsWith("multipart");

  test("81 a lost connection while placing keeps the form, explains, and a retry places one order", async ({ page }) => {
    const { shopper } = await ready("network");
    const before = stock(VARIANT);
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
    let blocked = 0;
    await page.route(/\/en\/checkout/, async (route) => {
      if (isOrderSubmit(route.request()) && blocked === 0) {
        blocked++;
        await route.abort("connectionfailed");
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(formAlert(page).filter({ hasText: "The connection dropped" })).toBeVisible();
    expect(blocked).toBe(1);
    // Still the real checkout, not an error page, and nothing was created or held.
    await expect(page.getByTestId("checkout-store")).toHaveCount(1);
    expect(orderCount(shopper.email)).toBe(0);
    expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity);

    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\?placed=1$/);
    expect(orderCount(shopper.email)).toBe(1);
    expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity + 1);
  });

  test("83 the order reached the server but the response was lost: the retry returns the same order", async ({ page }) => {
    const { shopper } = await ready("lost-response");
    const before = stock(VARIANT);
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
    let lost = 0;
    await page.route(/\/en\/checkout/, async (route) => {
      if (isOrderSubmit(route.request()) && lost === 0) {
        lost++;
        await route.fetch(); // the server processes it...
        await route.abort("connectionreset"); // ...and the browser never hears back
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(formAlert(page).filter({ hasText: "The connection dropped" })).toBeVisible();
    expect(orderCount(shopper.email), "the first request did create the order").toBe(1);

    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1$/);
    expect(orderCount(shopper.email), "the retry created no second order").toBe(1);
    expect(stock(VARIANT).reserved_quantity).toBe(before.reserved_quantity + 1);
  });

  test("82 orders are private: a guest and another customer cannot open one", async ({ page }) => {
    const { shopper, addressId } = await ready("private");
    const placed = await placeViaApi(shopper, addressId);
    expect(placed.status).toBe(201);
    const other = await createVerifiedShopper("private-other");
    expect((await api("GET", `/user/orders/${placed.data.id}`, { token: other.token })).status).toBe(404);
    await page.goto(`/en/account/orders/${placed.data.id}`);
    await expect(page).toHaveURL(/\/en\/login\?next=/);
    await signIn(page, other, { next: `/account/orders/${placed.data.id}` });
    await expect(page.locator("main")).not.toContainText(shopper.email);
    await expect(page.getByTestId("order-confirmation")).toHaveCount(0);
  });
});
