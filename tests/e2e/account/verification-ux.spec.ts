import { ACCOUNT_E2E, api, createShopper, expect, mailLink, signIn, test } from "./helpers";
import { addAddress } from "./orders";

/**
 * Email verification as a new customer experiences it (real-customer QA, 2026-11-10). An unverified
 * customer can sign in and shop; only placing an order needs a confirmed email. These cover the gaps
 * found by using the site: what the reminder says, where checkout says it, and every verify-link
 * outcome leaving the customer a way forward. LOCAL backend and its log mail transport only.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

const tokenPath = async (email: string) => (await mailLink(email, "verify-email")).replace(/^https?:\/\/[^/]+/, "");

test.describe("email verification reminders and links", () => {
  test("85 the account reminder says a confirmed email is needed to place orders (English and Arabic)", async ({ page }) => {
    const shopper = await createShopper("reminder-copy");
    await signIn(page, shopper);
    await page.goto("/en/account");
    await expect(page.getByTestId("verify-banner")).toContainText("to place orders");
    await page.goto("/ar/account");
    await expect(page.getByTestId("verify-banner")).toContainText("لتقديم الطلبات");
  });

  test("86 checkout tells an unverified customer about verification even before they have an address", async ({ page }) => {
    const shopper = await createShopper("no-address");
    expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } })).status).toBe(200);
    await signIn(page, shopper, { next: "/checkout" });
    await expect(page.getByRole("heading", { name: "Add a delivery address first" })).toBeVisible();
    await expect(page.getByTestId("checkout-verify-email")).toContainText("Verify your email to place your order");
    await expect(page.getByTestId("checkout-verify-email").getByRole("button", { name: "Send a new confirmation link" })).toBeVisible();
  });

  test("87 the checkout notice's resend button stays inside the notice (English and Arabic, desktop and tablet)", async ({ page }) => {
    const shopper = await createShopper("notice-layout");
    await addAddress(shopper);
    expect((await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } })).status).toBe(200);
    await signIn(page, shopper);
    for (const [locale, width] of [["en", 1440], ["ar", 1440], ["en", 768], ["ar", 768]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${locale}/checkout`);
      const notice = page.getByTestId("checkout-verify-email");
      const button = notice.getByRole("button");
      await expect(button).toBeVisible();
      const [n, b] = [(await notice.boundingBox())!, (await button.boundingBox())!];
      expect(b.x, `${locale} ${width}: button starts inside`).toBeGreaterThanOrEqual(n.x);
      expect(b.x + b.width, `${locale} ${width}: button ends inside`).toBeLessThanOrEqual(n.x + n.width);
    }
  });

  test("88 a malformed or missing link still offers a way to get a new one", async ({ page }) => {
    // Signed out: sign in to get a new link.
    await page.goto("/en/verify-email?token=not-a-real-token");
    await expect(page.getByTestId("verify-invalid")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to get a new link" })).toBeVisible();
    await page.goto("/en/verify-email");
    await expect(page.getByRole("link", { name: "Sign in to get a new link" })).toBeVisible();

    // Signed in and unverified: send a new link right here.
    const shopper = await createShopper("malformed");
    await signIn(page, shopper);
    await page.goto("/en/verify-email?token=short");
    await expect(page.getByTestId("verify-invalid")).toBeVisible();
    await page.getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(page.getByText(/cooldown|wait a minute|on its way/i)).toBeVisible();
  });

  test("90 when the confirmation email could not be sent, the account says so instead of 'we sent a link'", async ({ page }) => {
    const shopper = await createShopper("unsent");
    await signIn(page, shopper);
    // Registration lands here when the backend reports verification_email_sent: false (mail transport down).
    await page.goto("/en/account?welcome=unsent");
    await expect(page.getByText("we couldn't send the confirmation email")).toBeVisible();
    await expect(page.getByTestId("verify-banner")).not.toContainText("We sent a link");
    await expect(page.getByTestId("verify-banner")).toContainText("to place orders");
    await page.goto("/ar/account?welcome=unsent");
    await expect(page.getByText("تعذّر إرسال رسالة التأكيد")).toBeVisible();
  });

  test("89 reopening a used link while signed in and verified says already confirmed, with no resend", async ({ page }) => {
    const shopper = await createShopper("reused");
    const path = await tokenPath(shopper.email);
    await signIn(page, shopper);
    await page.goto(path);
    await expect(page.getByTestId("verify-verified")).toBeVisible();
    await page.goto(path);
    await expect(page.getByTestId("verify-already")).toBeVisible();
    await expect(page.getByText("This link is not valid")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send a new confirmation link" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Go to checkout" })).toBeVisible();
  });
});
