import { ACCOUNT_E2E, api, consoleErrors, createVerifiedShopper, ensureTestStock, expect, localDb, signIn, test, type Shopper } from "./helpers";
import { addAddress, expireDeadline, orderIdFromUrl, providerEvent } from "./orders";

/**
 * Order lifecycle on the order page, against the LOCAL backend: payment
 * deadline, customer cancellation, expiry, a late payment after
 * cancellation, and per-Store fulfillment/cancellation by the Store. The
 * backend's own commands/services stand in for the Merchant and the
 * scheduler (test-only, disposable DB) — the website never fakes a status.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeAll(() => {
  if (ACCOUNT_E2E) ensureTestStock();
});
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows (mobile layout covered by the visual sweep)"));

async function placeThroughCheckout(page: import("@playwright/test").Page, shopper: Shopper) {
  await addAddress(shopper);
  await api("POST", "/user/cart/items", { token: shopper.token, body: { product_variant_id: 49, quantity: 1, market: "EG" } });
  await signIn(page, shopper, { next: "/checkout" });
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page).toHaveURL(/\?placed=1$/);
  return orderIdFromUrl(page);
}

async function apiOrder(shopper: Shopper, orderId: string) {
  return (await api<{ status: string; payment_status: string; cancellation_reason: string | null; refund_status: string | null; stores: { id: string; status: string }[] }>("GET", `/user/orders/${orderId}`, { token: shopper.token })).data;
}

test.describe("order lifecycle", () => {
  test("54 an unpaid order shows its payment deadline and the customer can cancel it (confirm step)", async ({ page }) => {
    const errors = consoleErrors(page);
    const shopper = await createVerifiedShopper("cancel");
    const orderId = await placeThroughCheckout(page, shopper);

    await expect(page.getByTestId("order-pay-by")).toContainText("Please pay by");
    await expect(page.getByTestId("order-payment-status")).toHaveText("Payment pending");

    // The first click only asks; "Keep order" changes nothing.
    await page.getByTestId("cancel-order").click();
    await page.getByRole("button", { name: "Keep order" }).click();
    expect((await apiOrder(shopper, orderId)).status).toBe("placed");

    await page.getByTestId("cancel-order").click();
    await page.getByRole("button", { name: "Yes, cancel order" }).click();
    await expect(page).toHaveURL(new RegExp(`/account/orders/${orderId}\\?cancelled=1$`));
    await expect(page.getByText("Your order was cancelled.")).toBeVisible();
    await expect(page.getByTestId("order-notices")).toContainText("You cancelled this order.");
    await expect(page.locator("#payment")).toHaveCount(0);
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);
    await expect(page.getByTestId("order-payment-status")).toHaveText("Not paid");
    await expect(page.getByTestId("store-order-status").first()).toContainText("Cancelled");

    const order = await apiOrder(shopper, orderId);
    expect([order.status, order.cancellation_reason]).toEqual(["cancelled", "customer_requested"]);

    // The orders list shows the new status too.
    await page.goto("/en/account/orders");
    await expect(page.getByTestId("orders").locator("li").first()).toContainText("Cancelled");
    expect(errors).toEqual([]);
  });

  test("55 past the deadline the order cannot be paid, and the expiry job cancels it", async ({ page }) => {
    const shopper = await createVerifiedShopper("expire");
    const orderId = await placeThroughCheckout(page, shopper);
    expireDeadline(orderId);

    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("order-notices")).toContainText("The time to pay for this order has ended");
    await expect(page.locator("#payment")).toHaveCount(0);

    localDb(`echo json_encode(app(Modules\\Orders\\Services\\OrderLifecycleService::class)->expireOne(Modules\\Orders\\Models\\Order::where('uuid', '${orderId}')->value('id')));`);
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("order-notices")).toContainText("was not paid in time");
    expect((await apiOrder(shopper, orderId)).cancellation_reason).toBe("payment_expired");

    // Arabic page, same state.
    await page.goto(`/ar/account/orders/${orderId}`);
    await expect(page.getByTestId("order-notices")).toContainText("لعدم الدفع في الوقت المحدد");
  });

  test("56 a payment that arrives after cancellation is shown as a refund under review, never as paid", async ({ page }) => {
    const shopper = await createVerifiedShopper("late-pay");
    const orderId = await placeThroughCheckout(page, shopper);
    await page.getByTestId("cancel-order").click();
    await page.getByRole("button", { name: "Yes, cancel order" }).click();
    await expect(page).toHaveURL(/\?cancelled=1$/);

    expect(await providerEvent(shopper, orderId, "succeeded")).toBe("late_payment_refund_review");
    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("order-payment-status")).toHaveText("Payment received after cancellation");
    await expect(page.getByTestId("order-notices")).toContainText("It will be refunded to you");
    await expect(page.locator("#payment")).toHaveCount(0);
    const order = await apiOrder(shopper, orderId);
    expect([order.status, order.payment_status, order.refund_status]).toEqual(["cancelled", "paid_after_cancellation", "pending_manual_review"]);
  });

  test("57 the store's fulfillment steps and a store cancellation after payment appear on the order page", async ({ page }) => {
    const shopper = await createVerifiedShopper("fulfil");
    const orderId = await placeThroughCheckout(page, shopper);
    expect(await providerEvent(shopper, orderId, "succeeded")).toBe("captured");

    await page.goto(`/en/account/orders/${orderId}`);
    await expect(page.getByTestId("payment-paid")).toBeVisible();
    await expect(page.getByTestId("store-order-status").first()).toContainText("Confirmed");
    await expect(page.getByTestId("cancel-order")).toHaveCount(0);

    // The Store advances its part (its own authorized action through the backend service).
    const storeOrderId = (await apiOrder(shopper, orderId)).stores[0].id;
    const step = (status: string, extra = "") =>
      localDb(
        `$so = Modules\\Orders\\Models\\StoreOrder::where('uuid', '${storeOrderId}')->firstOrFail(); app(Modules\\Orders\\Services\\OrderLifecycleService::class)->transitionStoreOrder($so, Modules\\Orders\\Enums\\StoreOrderStatus::from('${status}'), new Modules\\Orders\\Support\\OrderActor(Modules\\Orders\\Enums\\OrderActorType::Merchant, $so->merchant_id)${extra}); echo 'ok';`,
      );
    step("processing");
    await page.reload();
    await expect(page.getByTestId("store-order-status").first()).toContainText("Processing");
    await expect(page.locator("h1").locator("..")).toContainText("Processing");

    step("cancelled", ", 'Damaged in warehouse', false");
    await page.reload();
    await expect(page.getByTestId("store-order-status").first()).toContainText("Cancelled");
    await expect(page.getByTestId("store-order-status").first()).toContainText("Refund under review");
    await expect(page.getByTestId("order-payment-status")).toHaveText("Paid");
    await expect(page.getByTestId("order-notices")).toContainText("The store cancelled this order.");
    await expect(page.getByTestId("order-notices")).toContainText("A refund is being reviewed by our team.");
    const order = await apiOrder(shopper, orderId);
    expect([order.status, order.payment_status, order.refund_status]).toEqual(["cancelled", "paid", "pending_manual_review"]);
  });
});
