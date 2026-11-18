import { ACCOUNT_E2E, ensureTestStock, PASSWORD, api, consoleErrors, createShopper, expect, mailLink, mailSubjects, sessionCookie, signIn, statusWith, test, uniquePhone, verifyShopperEmail, type Shopper } from "./helpers";

/**
 * Profile, security (password, email, phone, sessions), addresses with live
 * geography, and order history — real API, LOCAL backend only.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

async function signedIn(page: import("@playwright/test").Page, tag: string): Promise<Shopper> {
  const shopper = await createShopper(tag);
  await signIn(page, shopper);
  await expect(page).toHaveURL(/\/en\/account$/);
  return shopper;
}

/** A real order through the real checkout API: cart → address → quote → place. */
async function placeOrder(shopper: Shopper): Promise<{ id: string; order_number: string }> {
  await verifyShopperEmail(shopper); // a NEW order needs a verified email
  const token = shopper.token;
  const regions = await api<{ id: number }[]>("GET", "/countries/1/regions");
  const cities = await api<{ id: number }[]>("GET", `/regions/${regions.data[0].id}/cities`);
  const address = await api<{ id: number }>("POST", "/user/addresses", {
    token,
    body: { recipient_name: shopper.name, recipient_phone: shopper.phone, country_id: 1, region_id: regions.data[0].id, city_id: cities.data[0].id, address_line_1: "5 Tahrir Sq" },
  });
  expect(address.status).toBe(201);
  expect((await api("POST", "/user/cart/items", { token, body: { product_variant_id: 50, quantity: 1, market: "EG" } })).status).toBe(200);
  const quote = await api<{ stores: { store: { id: number }; shipping_options: { shipping_method_id: number }[] }[] }>("POST", "/user/checkout/quote", { token, body: { market: "EG", address_id: address.data.id } });
  const placed = await api<{ id: string; order_number: string }>("POST", "/user/orders", {
    token,
    body: {
      idempotency_key: `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      market: "EG",
      address_id: address.data.id,
      shipping_selections: quote.data.stores.map((s) => ({ store_id: s.store.id, shipping_method_id: s.shipping_options[0].shipping_method_id })),
    },
  });
  expect(placed.status, placed.message).toBe(201);
  return placed.data;
}

test.describe("profile", () => {
  test("23 edit name, gender and birth date; the header greeting follows", async ({ page }) => {
    const errors = consoleErrors(page);
    await signedIn(page, "profile");
    await page.goto("/en/account/profile");
    const form = page.getByTestId("profile-form");
    await form.getByLabel("Full name").fill("Laila Hassan");
    await form.getByLabel("Gender").selectOption("female");
    await form.getByLabel("Date of birth").fill("1994-05-17");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(statusWith(page, "Your profile was saved.")).toBeVisible();
    await page.reload();
    await expect(form.getByLabel("Full name")).toHaveValue("Laila Hassan");
    await expect(form.getByLabel("Gender")).toHaveValue("female");
    await expect(form.getByLabel("Date of birth")).toHaveValue("1994-05-17");
    await page.getByTestId("account-menu").click();
    await expect(page.getByRole("menu").getByText("Hello, Laila")).toBeVisible();
    await expect(page.getByTestId("account-menu")).toContainText("Hello, Laila");
    expect(errors).toEqual([]);
  });

  test("24 a future birth date is rejected by the API on that field", async ({ page }) => {
    await signedIn(page, "dob");
    await page.goto("/en/account/profile");
    const form = page.getByTestId("profile-form");
    // Bypass the browser's max= hint: the API is the authority.
    await form.getByLabel("Date of birth").evaluate((el: HTMLInputElement) => el.removeAttribute("max"));
    await form.getByLabel("Date of birth").fill("2999-01-01");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(form.getByLabel("Date of birth")).toHaveAttribute("aria-invalid", "true");
  });
});

test.describe("security", () => {
  test("25 change password: wrong current password is a field error", async ({ page }) => {
    await signedIn(page, "pw-wrong");
    await page.goto("/en/account/security");
    const form = page.getByTestId("password-form");
    await form.getByLabel("Current password").fill("not-my-password");
    await form.getByLabel("New password").fill("Next-pass-word-9");
    await form.getByLabel("Confirm password").fill("Next-pass-word-9");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(form.getByLabel("Current password")).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByText("Your current password is not correct.")).toBeVisible();
  });

  test("26 change password signs out the other device, keeps this one, notifies by email", async ({ page, browser }) => {
    const shopper = await signedIn(page, "pw");
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await signIn(other, shopper);
    await expect(other).toHaveURL(/\/en\/account$/);

    await page.goto("/en/account/security");
    const form = page.getByTestId("password-form");
    await form.getByLabel("Current password").fill(PASSWORD);
    await form.getByLabel("New password").fill("Next-pass-word-9");
    await form.getByLabel("Confirm password").fill("Next-pass-word-9");
    await form.getByRole("button", { name: "Change password" }).click();
    await expect(statusWith(page, "Your password was changed.")).toBeVisible();
    await expect(form.getByLabel("Current password")).toHaveValue("");

    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/account$/);
    await other.goto("/en/account");
    await expect(other).toHaveURL(/\/en\/login/);
    expect(mailSubjects(shopper.email).some((s) => /password/i.test(s) && /changed/i.test(s))).toBe(true);
    await otherContext.close();
  });

  test("27 change email: re-verification, notice to the old address, sign-in with the new one", async ({ page, context }) => {
    const shopper = await signedIn(page, "email");
    const next = shopper.email.replace("e2e-email", "e2e-email-new");
    await page.goto("/en/account/security");
    const form = page.getByTestId("email-form");
    await form.getByLabel("New email address").fill(next);
    await form.getByLabel("Current password").fill(PASSWORD);
    await form.getByRole("button", { name: "Change email" }).click();
    await expect(statusWith(page, `Your email is now ${next}`)).toBeVisible();

    expect(await mailLink(next, "verify-email")).toContain("/verify-email?token=");
    expect(mailSubjects(shopper.email).some((s) => /email/i.test(s) && /changed/i.test(s))).toBe(true);
    await page.reload();
    await expect(page.getByTestId("verification-status")).toContainText(next);
    await expect(page.getByTestId("verification-status")).toContainText("Not confirmed yet");

    await context.clearCookies();
    await signIn(page, { email: next, password: PASSWORD });
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("28 change mobile number needs the password", async ({ page }) => {
    await signedIn(page, "phone");
    const phone = uniquePhone();
    await page.goto("/en/account/security");
    const form = page.getByTestId("phone-form");
    await form.getByLabel("Mobile number").fill(phone);
    await form.getByLabel("Current password").fill("wrong-one");
    await form.getByRole("button", { name: "Save mobile number" }).click();
    await expect(form.getByLabel("Current password")).toHaveAttribute("aria-invalid", "true");
    await form.getByLabel("Current password").fill(PASSWORD);
    await form.getByRole("button", { name: "Save mobile number" }).click();
    await expect(statusWith(page, "Your mobile number was updated.")).toBeVisible();
    await page.goto("/en/account/profile");
    await expect(page.getByText(phone)).toBeVisible();
  });

  test("29 signed-in devices: this device is named and marked; another can be signed out", async ({ page }) => {
    const shopper = await signedIn(page, "sessions");
    const tablet = await api<{ token: string }>("POST", "/user/auth/login", { body: { email: shopper.email, password: PASSWORD, device_name: "Tablet in the kitchen" } });
    await page.goto("/en/account/security");
    const list = page.getByTestId("sessions");
    await expect(list.getByText("This device")).toBeVisible();
    await expect(list.locator("li").filter({ hasText: "This device" })).toContainText("Chrome on");
    await list.getByRole("button", { name: "Sign out Tablet in the kitchen" }).click();
    await expect(statusWith(page, "That device was signed out.")).toBeVisible();
    expect((await api("GET", "/user/auth/me", { token: tablet.data.token })).status).toBe(401);
    await expect(list.getByText("Tablet in the kitchen")).toHaveCount(0);
  });

  test("30 sign out all other devices at once", async ({ page }) => {
    const shopper = await signedIn(page, "others");
    const tokens = await Promise.all([1, 2].map(() => api<{ token: string }>("POST", "/user/auth/login", { body: { email: shopper.email, password: PASSWORD } })));
    await page.goto("/en/account/security");
    // createShopper's own token + 2 logins = 3 other devices.
    await page.getByRole("button", { name: "Sign out 3 other devices" }).click();
    await expect(statusWith(page, "3 other devices were signed out.")).toBeVisible();
    for (const t of tokens) expect((await api("GET", "/user/auth/me", { token: t.data.token })).status).toBe(401);
    await expect(page.getByText("No other devices are signed in.")).toBeVisible();
    expect(await sessionCookie(page)).toBeDefined();
  });
});

test.describe("addresses", () => {
  test("31 first address with live country → region → city lists becomes the default", async ({ page }) => {
    const errors = consoleErrors(page);
    await signedIn(page, "addr");
    await page.goto("/en/account/addresses");
    await expect(page.getByRole("heading", { name: "No saved addresses" })).toBeVisible();
    await page.getByRole("link", { name: "Add address" }).click();
    const form = page.getByTestId("address-form");
    await expect(form.getByLabel("Recipient name")).toHaveValue("Mona Adel");
    await expect(form.getByLabel("City / district")).toBeDisabled();
    await form.getByLabel("Country").selectOption({ label: "Egypt" });
    await form.getByLabel("Governorate / region").selectOption({ label: "Giza" });
    await expect(form.getByLabel("City / district")).toBeEnabled();
    // Exactly the active cities the public API lists for Giza right now (admins add cities at any time).
    const regions = await api<{ id: number; name: string }[]>("GET", "/countries/1/regions");
    const giza = regions.data.find((r) => r.name === "Giza")!;
    const cities = await api<{ name: string }[]>("GET", `/regions/${giza.id}/cities`);
    expect(cities.data.map((c) => c.name)).toContain("Dokki");
    await expect(form.getByLabel("City / district").locator("option")).toHaveText(["Choose…", ...cities.data.map((c) => c.name)]);
    await form.getByLabel("City / district").selectOption({ label: "Dokki" });
    await form.getByLabel("Street and number").fill("14 Tahrir St");
    await form.getByLabel("Building").fill("9");
    await expect(page.getByText("This will be your default delivery address.")).toBeVisible();
    await form.getByRole("button", { name: "Save address" }).click();

    await expect(page).toHaveURL(/\/en\/account\/addresses\?saved=created$/);
    await expect(page.getByText("Address added.")).toBeVisible();
    const card = page.getByTestId("address-card");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Default");
    await expect(card).toContainText("Dokki, Giza, Egypt");
    await expect(card).toContainText("Building 9");
    expect(errors).toEqual([]);
  });

  test("32 required address fields are reported by the API", async ({ page }) => {
    await signedIn(page, "addr-req");
    await page.goto("/en/account/addresses/new");
    const form = page.getByTestId("address-form");
    await form.getByLabel("Recipient name").fill("");
    await form.getByRole("button", { name: "Save address" }).click();
    for (const label of ["Recipient name", "Governorate / region", "City / district", "Street and number"]) {
      await expect(form.getByLabel(label)).toHaveAttribute("aria-invalid", "true");
    }
    await expect(page).toHaveURL(/\/addresses\/new$/);
  });

  test("33 edit an address: saved region and city are preselected and can change", async ({ page }) => {
    const shopper = await signedIn(page, "addr-edit");
    const regions = await api<{ id: number; name: string }[]>("GET", "/countries/1/regions");
    const cairo = regions.data[0];
    const cities = await api<{ id: number }[]>("GET", `/regions/${cairo.id}/cities`);
    const created = await api<{ id: number }>("POST", "/user/addresses", {
      token: shopper.token,
      body: { recipient_name: "Mona", recipient_phone: shopper.phone, country_id: 1, region_id: cairo.id, city_id: cities.data[0].id, address_line_1: "1 Old St" },
    });
    await page.goto(`/en/account/addresses/${created.data.id}/edit`);
    const form = page.getByTestId("address-form");
    await expect(form.getByLabel("Governorate / region")).toHaveValue(String(cairo.id));
    await expect(form.getByLabel("City / district")).toHaveValue(String(cities.data[0].id));
    await form.getByLabel("City / district").selectOption({ label: "Maadi" });
    await form.getByLabel("Street and number").fill("2 New St");
    await form.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Address updated.")).toBeVisible();
    await expect(page.getByTestId("address-card")).toContainText("2 New St");
    await expect(page.getByTestId("address-card")).toContainText("Maadi, Cairo, Egypt");
  });

  test("34 a second address can become the default; deleting asks first", async ({ page }) => {
    const shopper = await signedIn(page, "addr-def");
    const regions = await api<{ id: number }[]>("GET", "/countries/1/regions");
    const cities = await api<{ id: number }[]>("GET", `/regions/${regions.data[0].id}/cities`);
    for (const label of ["Home", "Office"]) {
      const created = await api("POST", "/user/addresses", {
        token: shopper.token,
        body: { label, recipient_name: "Mona", recipient_phone: shopper.phone, country_id: 1, region_id: regions.data[0].id, city_id: cities.data[0].id, address_line_1: `${label} street` },
      });
      expect(created.status, created.message).toBe(201);
    }
    await page.goto("/en/account/addresses");
    await page.getByRole("button", { name: "Set Office as default address" }).click();
    await expect(page.getByText("Default address changed.")).toBeVisible();
    await expect(page.getByTestId("address-card").filter({ hasText: "Office" })).toContainText("Default");

    const home = page.getByTestId("address-card").filter({ hasText: "Home street" });
    await home.getByRole("button", { name: "Delete Home" }).click();
    await expect(home.getByText("Delete this address?")).toBeVisible();
    await home.getByRole("button", { name: "Keep" }).click();
    await expect(page.getByTestId("address-card")).toHaveCount(2);
    await home.getByRole("button", { name: "Delete Home" }).click();
    await home.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText("Address deleted.")).toBeVisible();
    await expect(page.getByTestId("address-card")).toHaveCount(1);
  });

  test("35 another customer's address is not found", async ({ page }) => {
    const owner = await createShopper("addr-owner");
    const regions = await api<{ id: number }[]>("GET", "/countries/1/regions");
    const cities = await api<{ id: number }[]>("GET", `/regions/${regions.data[0].id}/cities`);
    const theirs = await api<{ id: number }>("POST", "/user/addresses", {
      token: owner.token,
      body: { recipient_name: "Owner", recipient_phone: owner.phone, country_id: 1, region_id: regions.data[0].id, city_id: cities.data[0].id, address_line_1: "Private St" },
    });
    await signedIn(page, "addr-intruder");
    const res = await page.goto(`/en/account/addresses/${theirs.data.id}/edit`);
    expect(res?.status()).toBe(404);
    await expect(page.getByText("Private St")).toHaveCount(0);
  });
});

test.describe("orders", () => {
  test("36 no orders yet: an honest empty state", async ({ page }) => {
    await signedIn(page, "no-orders");
    await page.goto("/en/account/orders");
    await expect(page.getByRole("heading", { name: "You have no orders yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Start shopping" })).toHaveAttribute("href", "/en/products");
  });

  test("37 a placed order: list, overview and detail with items, address and totals", async ({ page }) => {
    const shopper = await createShopper("order");
    const order = await placeOrder(shopper);
    await signIn(page, shopper);
    await expect(page.getByText(`#${order.order_number}`)).toBeVisible();

    await page.goto("/en/account/orders");
    await expect(page.getByTestId("orders").locator("li")).toHaveCount(1);
    await page.getByRole("link", { name: new RegExp(order.order_number) }).click();
    await expect(page).toHaveURL(new RegExp(`/en/account/orders/${order.id}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`#${order.order_number}`);
    // Order status next to the number, and the (one) store's own status.
    await expect(page.getByRole("heading", { level: 1 }).locator("..").getByText("Placed", { exact: true })).toBeVisible();
    await expect(page.getByTestId("store-order-status")).toHaveText("Placed");
    await expect(page.getByRole("link", { name: /Essential Crew-Neck T-Shirt/ })).toHaveAttribute("href", /\/en\/products\/cotton-lane-essential-crew-neck-t-shirt\?variant=50$/);
    await expect(page.getByText("White / XL")).toBeVisible();
    await expect(page.getByText("5 Tahrir Sq")).toBeVisible();
    await expect(page.getByText("Total", { exact: true })).toBeVisible();
    // Items and delivery are shown gross: the tax line is included in them, not added on top (as at checkout).
    await expect(page.getByText("Includes tax", { exact: true })).toBeVisible();
  });

  test("38 another customer's order is not found", async ({ page }) => {
    const owner = await createShopper("order-owner");
    const order = await placeOrder(owner);
    await signedIn(page, "order-intruder");
    const res = await page.goto(`/en/account/orders/${order.id}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(order.order_number)).toHaveCount(0);
  });
});
