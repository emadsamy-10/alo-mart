import crypto from "node:crypto";
import fs from "node:fs";
import type { Page } from "@playwright/test";
import { ACCOUNT_API, api, expect, localDb, type Shopper } from "./helpers";

/*
 * Order helpers for the LOCAL backend's test-only `sandbox` payment driver:
 * no network, no money. `providerEvent` plays the payment PROVIDER by sending
 * an HMAC-signed webhook — the only way the backend records a payment result.
 *
 *   E2E_SANDBOX_SECRET_FILE  file holding the local sandbox webhook secret
 */
const SECRET_FILE = process.env.E2E_SANDBOX_SECRET_FILE ?? "";

export async function addAddress(shopper: Shopper, label = "Home") {
  const regions = await api<{ id: number }[]>("GET", "/countries/1/regions");
  const cities = await api<{ id: number }[]>("GET", `/regions/${regions.data[0].id}/cities`);
  const res = await api<{ id: number }>("POST", "/user/addresses", {
    token: shopper.token,
    body: { label, recipient_name: shopper.name, recipient_phone: shopper.phone, country_id: 1, region_id: regions.data[0].id, city_id: cities.data[0].id, address_line_1: `${label} 7 Nile Corniche` },
  });
  expect(res.status, res.message).toBe(201);
  return res.data.id;
}

/** Act as the sandbox payment provider: a signed event for the order's current attempt. */
export async function providerEvent(shopper: Shopper, orderId: string, type: "succeeded" | "failed" | "processing") {
  expect(SECRET_FILE, "E2E_SANDBOX_SECRET_FILE must point at the local sandbox secret").not.toBe("");
  const secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  const payment = await api<{ amount: string; currency: { code: string }; current_attempt: { id: string } }>("GET", `/user/orders/${orderId}/payment`, { token: shopper.token });
  expect(payment.status).toBe(200);
  const attempt = payment.data.current_attempt.id;
  const body = JSON.stringify({
    id: `evt_${crypto.randomUUID()}`,
    type,
    provider_reference: `sbx_${attempt.replace(/-/g, "")}`,
    attempt_reference: attempt,
    amount: payment.data.amount,
    currency: payment.data.currency.code,
    occurred_at: new Date().toISOString(),
  });
  const res = await fetch(`${ACCOUNT_API}/payments/webhooks/sandbox`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Sandbox-Signature": crypto.createHmac("sha256", secret).update(body).digest("hex") },
    body,
  });
  expect(res.status).toBe(200);
  return ((await res.json()) as { data: { result: string } }).data.result;
}

export async function orderIdFromUrl(page: Page) {
  const match = /\/account\/orders\/([0-9a-f-]{36})/.exec(page.url());
  expect(match, page.url()).not.toBeNull();
  return match![1];
}

/** Test-only: move the order's payment deadline into the past (the disposable local DB). */
export function expireDeadline(orderId: string) {
  localDb(`DB::table('orders')->where('uuid', '${orderId}')->update(['payment_due_at' => now()->subMinute()]);`);
}

/** Test-only: a Merchant/system lifecycle action through the backend's own service (no Merchant UI exists here). */
export function lifecycle(php: string) {
  return localDb(php);
}
