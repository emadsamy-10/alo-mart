import { ACCOUNT_E2E, api, consoleErrors, createShopper, ensureTestStock, expect, localDb, mailCount, mailLink, signIn, test, type Shopper } from "./helpers";
import { addAddress } from "./orders";

/**
 * A NEW order needs a verified email (backend: 403 `email_unverified` on
 * POST /user/orders). Shopping, the cart and the account work unverified;
 * checkout explains the rule, offers a new link, and continues — same cart,
 * same address — once the customer opens the emailed link. LOCAL backend and
 * its log mail transport only: nothing is delivered anywhere.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows (mobile layout covered by the visual sweep)"));

async function unverifiedWithCart(tag: string): Promise<Shopper> {
  const shopper = await createShopper(tag); // registration sends the first verification email
  await addAddress(shopper);
  expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } })).status).toBe(200);
  return shopper;
}

const cartLines = async (shopper: Shopper) => (await api<{ items: unknown[] }>("GET", "/user/cart?market=EG", { token: shopper.token })).data.items.length;
const orderCount = async (shopper: Shopper) => (await api<{ items: unknown[] }>("GET", "/user/orders", { token: shopper.token })).data.items.length;

test.describe("verified email before ordering", () => {
  test("58 an unverified customer is asked to verify, keeps the cart, verifies from the email and places the order", async ({ page }) => {
    const errors = consoleErrors(page);
    const shopper = await unverifiedWithCart("unverified-checkout");
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page).toHaveURL(/\/en\/checkout$/);

    // Checkout explains the rule up front; the form is still the real checkout.
    const notice = page.getByTestId("checkout-verify-email");
    await expect(notice).toContainText("Verify your email to place your order");
    await expect(page.getByTestId("checkout-store")).toHaveCount(1);

    // The backend refuses: nothing is placed, the cart is unchanged.
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Please verify your email address before placing an order" })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/checkout$/);
    expect(await orderCount(shopper)).toBe(0);
    expect(await cartLines(shopper)).toBe(1);

    // A new link from checkout. Registration sent one seconds ago, so the backend's 60 s resend
    // cooldown answers first and nothing is sent.
    const before = mailCount(shopper.email, "verify-email");
    await notice.getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(notice.getByRole("alert").filter({ hasText: "Please wait a minute before requesting another email." })).toBeVisible();
    expect(mailCount(shopper.email, "verify-email")).toBe(before);

    // A minute later (test-only: the disposable local DB's last link is aged), the resend sends a real email.
    localDb(`DB::table('user_email_verification_tokens')->where('user_id', DB::table('users')->where('email', '${shopper.email}')->value('id'))->update(['created_at' => now()->subMinutes(2)]);`);
    await notice.getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(notice.getByRole("status").filter({ hasText: "A new confirmation link is on its way." })).toBeVisible();
    const link = await mailLink(shopper.email, "verify-email", { after: before });

    // The customer opens it and returns to checkout from the confirmation page.
    await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.getByTestId("verify-verified")).toContainText("Your email is confirmed");
    await page.getByTestId("verify-to-checkout").click();
    await expect(page).toHaveURL(/\/en\/checkout$/);
    await expect(page.getByTestId("checkout-verify-email")).toHaveCount(0);
    await expect(page.getByTestId("checkout-store")).toHaveCount(1);

    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page).toHaveURL(/\/en\/account\/orders\/[0-9a-f-]{36}\?placed=1/);
    expect(await orderCount(shopper)).toBe(1);
    expect(errors).toEqual([]);
  });

  test("59 Arabic: the notice and the refusal are in Arabic", async ({ page }) => {
    const shopper = await unverifiedWithCart("unverified-ar");
    await signIn(page, shopper, { locale: "ar", next: "/checkout" });
    await expect(page).toHaveURL(/\/ar\/checkout$/);

    await expect(page.getByTestId("checkout-verify-email")).toContainText("أكّد بريدك الإلكتروني لتقديم طلبك");
    await page.getByTestId("checkout-form").locator('button[type="submit"]').last().click();
    await expect(page.getByRole("alert").filter({ hasText: "يرجى تأكيد بريدك الإلكتروني قبل تقديم الطلب" })).toBeVisible();
    expect(await orderCount(shopper)).toBe(0);
    expect(await cartLines(shopper)).toBe(1);
  });
});
