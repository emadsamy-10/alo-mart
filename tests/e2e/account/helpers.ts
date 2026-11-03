import { execFileSync } from "node:child_process";
import path from "node:path";
import { test as base, expect as baseExpect, type Page } from "@playwright/test";
import { mailLink } from "./mail";

/**
 * Account E2E runs ONLY against a LOCAL, disposable backend: these tests
 * create customers, addresses, carts and sessions. They never run against
 * staging or production — `ACCOUNT_API` must point at localhost, or every
 * account test is skipped.
 *
 *   E2E_ACCOUNT_API      local API base (default http://127.0.0.1:8098/api/v1)
 *   E2E_MAIL_LOG         the backend's local mail log (MAIL_MAILER=log)
 *   E2E_BACKEND_RUNTIME  folder with artisan.php for the local runtime (test-only DB tweaks)
 */
export const ACCOUNT_API = process.env.E2E_ACCOUNT_API ?? "http://127.0.0.1:8098/api/v1";
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(ACCOUNT_API);
export const ACCOUNT_E2E = process.env.E2E_ACCOUNT === "1" && LOCAL;
export { mailCount, mailLink, mailSubjects } from "./mail";
export const BACKEND_RUNTIME = process.env.E2E_BACKEND_RUNTIME ?? "";
export const PASSWORD = "Str0ng-pass-word";
export const TEE = "cotton-lane-essential-crew-neck-t-shirt";

let counter = 0;
/** A distinct shopper IP per test: the storefront forwards it, so API rate limits apply per test. */
export function shopperIp(): string {
  const n = (process.pid * 97 + Date.now() + counter++) % 65000;
  return `198.18.${Math.floor(n / 250) % 250}.${(n % 250) + 1}`;
}

export function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@alo-mart.test`;
}

export function uniquePhone(): string {
  return `015${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
}

interface ApiOptions {
  token?: string;
  body?: unknown;
  ip?: string;
  locale?: string;
}

export async function api<T = unknown>(method: string, apiPath: string, options: ApiOptions = {}): Promise<{ status: number; data: T; message?: string; code?: string; errors?: Record<string, string[]> }> {
  const res = await fetch(`${ACCOUNT_API}${apiPath}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Language": options.locale ?? "en",
      "X-Forwarded-For": options.ip ?? shopperIp(),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = (await res.json().catch(() => ({}))) as { data: T; message?: string; code?: string; errors?: Record<string, string[]> };
  return { ...json, status: res.status };
}

export interface Shopper {
  name: string;
  email: string;
  phone: string;
  password: string;
  token: string;
}

/** A real customer created through the public registration API (not through the UI). */
export async function createShopper(tag: string, extra: Partial<Pick<Shopper, "name">> = {}): Promise<Shopper> {
  const shopper = { name: extra.name ?? "Mona Adel", email: uniqueEmail(tag), phone: uniquePhone(), password: PASSWORD };
  const res = await api<{ token: string }>("POST", "/user/auth/register", {
    body: { ...shopper, password_confirmation: PASSWORD, device_name: "API setup" },
  });
  expect(res.status, JSON.stringify(res.errors ?? res.message)).toBe(201);
  return { ...shopper, token: res.data.token };
}

/**
 * Verifies the shopper's email the way a customer does: the link from the
 * verification email registration sent (local mail log), submitted to the
 * real verify endpoint. A NEW order needs a verified email.
 */
export async function verifyShopperEmail(shopper: Pick<Shopper, "email">) {
  const token = new URL(await mailLink(shopper.email, "verify-email")).searchParams.get("token");
  const res = await api("POST", "/user/auth/email/verify", { body: { token } });
  expect(res.status, res.message).toBe(200);
}

/** A registered customer whose email is verified (can place orders). */
export async function createVerifiedShopper(tag: string, extra: Partial<Pick<Shopper, "name">> = {}): Promise<Shopper> {
  const shopper = await createShopper(tag, extra);
  await verifyShopperEmail(shopper);
  return shopper;
}

/** Test-only: change the disposable local database (e.g. make a link expire). */
export function localDb(php: string): string {
  expect(BACKEND_RUNTIME, "E2E_BACKEND_RUNTIME must point at the local runtime").not.toBe("");
  return execFileSync("php", [path.join(BACKEND_RUNTIME, "artisan.php"), "tinker", `--execute=${php}`], { cwd: BACKEND_RUNTIME, encoding: "utf8" });
}

/**
 * Test-only: every placed test order reserves real stock in the disposable
 * local DB, so repeated runs exhaust the demo inventory. Keep the variants
 * these specs buy (Cotton Lane tee White/L, White/XL) purchasable.
 */
export function ensureTestStock() {
  localDb(`DB::table('inventories')->whereIn('product_variant_id', [1, 49, 50])->update(['on_hand_quantity' => DB::raw('reserved_quantity + 500')]);`);
}

/** Sign in through the real form. */
export async function signIn(page: Page, shopper: Pick<Shopper, "email" | "password">, { locale = "en", remember = false, next }: { locale?: string; remember?: boolean; next?: string } = {}) {
  await page.goto(`/${locale}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  const form = page.getByTestId("login-form");
  await form.getByLabel(locale === "ar" ? "البريد الإلكتروني" : "Email address").fill(shopper.email);
  await form.getByLabel(locale === "ar" ? "كلمة المرور" : "Password", { exact: true }).fill(shopper.password);
  if (remember) await form.getByLabel(locale === "ar" ? "إبقائي مسجّلًا للدخول" : "Keep me signed in").check();
  await form.getByRole("button", { name: locale === "ar" ? "تسجيل الدخول" : "Sign in" }).click();
  // Done when the page leaves sign-in, or the form reports a problem.
  await page.waitForFunction(
    () => !location.pathname.endsWith("/login") || !!document.querySelector('[data-testid="login-form"] [role="alert"]'),
    null,
    { timeout: 30_000 },
  );
}

export async function sessionCookie(page: Page) {
  return (await page.context().cookies()).find((c) => c.name === "alo_session");
}

export function consoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // A 401/404/422/429 the app handles on purpose is logged by the browser for document requests only; images may 50x locally.
    if (m.type() === "error" && !/status of (40[1349]|422|429|50[234])/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

/** Every account test: local backend only, and a distinct forwarded IP per test. */
export const test = base.extend<{ ip: string }>({
  ip: async ({}, provide) => provide(shopperIp()),
  extraHTTPHeaders: async ({ ip }, provide) => provide({ "X-Forwarded-For": ip }),
});

/**
 * The local backend runs on php -S (Laravel boots on every request), so one
 * sign-in + account render is several seconds: wait up to 20 s.
 */
export const expect = baseExpect.configure({ timeout: 20_000 });

/** The form-level alert (not Next's empty route announcer, which is also role=alert). */
export const formAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

/** A visible status message containing this text (the cart's live region is also role=status). */
export const statusWith = (page: Page, text: string | RegExp) => page.getByRole("status").filter({ hasText: text });

/** The session token as stored (the cookie value is URL-encoded). */
export async function sessionToken(page: Page): Promise<string> {
  const cookie = await sessionCookie(page);
  return decodeURIComponent(cookie?.value ?? "");
}
