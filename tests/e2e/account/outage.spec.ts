import { execSync, spawn } from "node:child_process";
import path from "node:path";
import { ACCOUNT_E2E, BACKEND_RUNTIME, createShopper, expect, signIn, test } from "./helpers";

/**
 * Journey H — API outage → honest error state → "Try again" → recovery.
 * The storefront calls the API server-side, so the outage must be real: this
 * spec stops the LOCAL API's front proxy (127.0.0.1:8098) and restarts it.
 * Opt-in (E2E_OUTAGE=1), serial, and never run alongside other specs.
 */
test.skip(!ACCOUNT_E2E || process.env.E2E_OUTAGE !== "1", "outage E2E needs E2E_OUTAGE=1 and the LOCAL backend runtime");
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop only"));

function pidOn(port: number): string | undefined {
  const lines = execSync("netstat -ano").toString().split(/\r?\n/);
  return lines.find((l) => l.includes(`127.0.0.1:${port} `) && l.includes("LISTENING"))?.trim().split(/\s+/).pop();
}

function stopApi() {
  const pid = pidOn(8098);
  if (pid) execSync(`taskkill /PID ${pid} /F`);
}

async function startApi() {
  spawn("node", [path.join(BACKEND_RUNTIME, "front.mjs"), "8098", "8099"], { cwd: BACKEND_RUNTIME, detached: true, stdio: "ignore" }).unref();
  await expect.poll(async () => (await fetch("http://127.0.0.1:8098/api/v1/markets").catch(() => null))?.status ?? 0, { timeout: 30_000 }).toBe(200);
}

test.afterAll(async () => {
  if (!pidOn(8098)) await startApi();
});

test("53 catalog, account and checkout show an error during an API outage and recover with Try again", async ({ page }) => {
  const shopper = await createShopper("outage");
  await signIn(page, shopper);
  await expect(page).toHaveURL(/\/en\/account$/);

  stopApi();
  try {
    // Catalog: a never-cached filter set → error boundary (500), never an empty "no products" page.
    const catalogUrl = `/en/products?min=1.5&max=${100000 + Math.floor(Math.random() * 899999)}`;
    const response = await page.goto(catalogUrl);
    expect(response?.status()).toBe(500);
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();

    // Account data: an outage is not "signed out".
    await page.goto("/en/account/addresses");
    await expect(page.getByRole("heading", { name: "Your account is not available right now" })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/account\/addresses$/);

    await page.goto("/en/checkout");
    await expect(page.getByRole("heading", { name: "Your account is not available right now" })).toBeVisible();
  } finally {
    await startApi();
  }

  // Recovery: the retry controls lead back to working pages.
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByRole("heading", { name: "Your account is not available right now" })).toHaveCount(0);
  await page.goto("/en/account/addresses");
  await expect(page.getByRole("heading", { level: 1, name: "Addresses" })).toBeVisible();
});
