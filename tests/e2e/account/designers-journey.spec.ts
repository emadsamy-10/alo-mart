import path from "node:path";
import { ACCOUNT_E2E, api, createShopper, createVerifiedShopper, expect, formAlert, localDb, signIn, test } from "./helpers";

/**
 * Designers & Subscriptions end to end on the LOCAL disposable backend:
 * same customer login for designers, admin approval, subscription REQUEST →
 * admin grant (never a payment), Studio draft → photos → video → review →
 * publish, Customer Plus follow/save, independent audiences, revocation
 * hiding public content without deleting it, and the unverified refusal.
 * Admin decisions go through the real admin API with a test-only admin.
 */
test.skip(!ACCOUNT_E2E, "Needs E2E_ACCOUNT=1 and a local API");
test.describe.configure({ mode: "serial" });

const IMAGE = path.join(__dirname, "..", "..", "fixtures", "design-photo.jpg");

let adminToken = "";
async function admin(method: string, apiPath: string, body?: unknown) {
  const res = await api(method, `/admin${apiPath}`, { token: adminToken, body });
  return res;
}

test.beforeAll(() => {
  // A throwaway super-admin token in the disposable DB (printed once, kept in memory only).
  const out = localDb(
    `$a = Modules\\Admins\\Models\\Admin::factory()->create(); $a->assignRole("super-admin"); echo "TOKEN=".$a->createToken("e2e")->plainTextToken;`,
  );
  adminToken = /TOKEN=(\S+)/.exec(out)?.[1] ?? "";
  expect(adminToken).not.toBe("");
});

async function activePlan(audience: "designer" | "customer") {
  const code = `e2e-${audience}-${Date.now()}`;
  const currencies = await api<{ id: number; code: string }[]>("GET", "/currencies");
  const egp = (currencies.data ?? []).find((c) => c.code === "EGP") ?? currencies.data?.[0];
  const created = await admin("POST", "/user-subscription-plans", {
    audience, code, name_en: `E2E ${audience} ${code.slice(-5)}`, currency_id: egp?.id, monthly_amount: "100",
  });
  expect(created.status, JSON.stringify(created)).toBe(201);
  const id = (created.data as { id: number }).id;
  expect((await admin("POST", `/user-subscription-plans/${id}/activate`)).status).toBe(200);
  return { id, name: `E2E ${audience} ${code.slice(-5)}` };
}

async function grantPending(email: string) {
  const list = await admin("GET", `/user-subscription-requests?status=pending&q=${encodeURIComponent(email)}`);
  const items = (list.data as { items: { id: number }[] }).items;
  expect(items.length).toBeGreaterThan(0);
  for (const r of items) {
    const [a, b] = await Promise.all([admin("POST", `/user-subscription-requests/${r.id}/grant`, {}), admin("POST", `/user-subscription-requests/${r.id}/grant`, {})]);
    // Concurrent double grant: exactly one succeeds.
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  }
}

test("designer journey: apply → approve → request → grant → draft → publish → revoke → renew", async ({ page }) => {
  const designerPlan = await activePlan("designer");
  const shopper = await createVerifiedShopper("designer", { name: "Laila Designer" });
  await signIn(page, shopper, { next: "/account/designer" });

  // Same account, no second sign-up.
  const form = page.getByTestId("designer-apply-form");
  await form.getByLabel("Display name").fill(`Laila Studio ${Date.now() % 100000}`);
  await form.getByLabel("Specialties").fill("Interior, Furniture");
  await form.getByRole("button", { name: "Send application" }).click();
  await expect(page).toHaveURL(/applied=1/);
  await expect(page.getByTestId("designer-status")).toContainText("Under review");

  const me = await api<{ profile: { id: number; slug: string } }>("GET", "/user/designer", { token: shopper.token });
  const { id: profileId, slug } = me.data.profile;
  expect((await api("GET", `/designers/${slug}`)).status).toBe(404);
  expect((await admin("POST", `/designers/${profileId}/approve`, {})).status).toBe(200);

  // Request the plan (not a payment), admin grants it.
  await page.goto("/en/subscriptions?for=designers");
  const card = page.getByTestId("plan-card").filter({ hasText: designerPlan.name });
  await card.getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/requested=designer/);
  await grantPending(shopper.email);

  // Studio: draft, photo, video, submit.
  await page.goto("/en/account/designer/designs/new");
  const design = page.getByTestId("design-form");
  await design.getByLabel("Title").fill("E2E courtyard house");
  await design.getByLabel("Category").selectOption("architecture");
  await design.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/designs\/\d+\?created=1/);
  const designId = Number(/designs\/(\d+)/.exec(page.url())?.[1]);
  await page.getByTestId("upload-image-form").locator("input[type=file]").setInputFiles(IMAGE);
  await page.getByTestId("upload-image-form").getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByTestId("design-images").locator("li")).toHaveCount(1);
  const video = page.getByTestId("add-video-form");
  await video.getByLabel("YouTube or Vimeo link").fill("https://example.com/video.mp4");
  await video.getByRole("button", { name: "Add video" }).click();
  await expect(formAlert(page).first()).toBeVisible();
  await page.getByTestId("add-video-form").getByLabel("YouTube or Vimeo link").fill("https://vimeo.com/123456789");
  await page.getByTestId("add-video-form").getByRole("button", { name: "Add video" }).click();
  await expect(page.getByTestId("design-videos")).toBeVisible();
  await page.getByTestId("submit-design").getByRole("button").click();
  await expect(page.getByTestId("review-panel")).toContainText("Under review");

  // Admin publishes → public.
  expect((await admin("POST", `/designs/${designId}/approve`, {})).status).toBe(200);
  const designSlug = (await api<{ slug: string }>("GET", `/user/designer/designs/${designId}`, { token: shopper.token })).data.slug;
  await page.goto(`/en/designs/${designSlug}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E courtyard house");
  await page.getByRole("button", { name: /Play video/ }).click();
  await expect(page.locator("iframe")).toHaveAttribute("src", /^https:\/\/player\.vimeo\.com\/video\/123456789/);

  // Revoke → hidden, nothing deleted; Studio tells the truth.
  const subs = await admin("GET", `/user-subscriptions?q=${encodeURIComponent(shopper.email)}&audience=designer`);
  const subId = (subs.data as { items: { id: number }[] }).items[0].id;
  expect((await admin("POST", `/user-subscriptions/${subId}/revoke`, { reason: "E2E revoke" })).status).toBe(200);
  expect((await page.goto(`/en/designs/${designSlug}`))?.status()).toBe(404);
  await page.goto(`/en/account/designer/designs/${designId}`);
  await expect(page.getByTestId("review-panel")).toContainText("not visible on the site");

  // Renewal through the same request → grant restores it.
  await page.goto("/en/subscriptions?for=designers");
  await page.getByTestId("plan-card").filter({ hasText: designerPlan.name }).getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/requested=designer/);
  await grantPending(shopper.email);
  expect((await page.goto(`/en/designs/${designSlug}`))?.status()).toBe(200);
});

test("Customer Plus: refused without it, follow/save with it, independent from the designer plan", async ({ page }) => {
  const customerPlan = await activePlan("customer");
  const listed = await api<{ items: { slug: string }[] }>("GET", "/designs");
  test.skip(!listed.data.items.length, "needs a published design from the previous test");
  const designSlug = listed.data.items[0].slug;
  const member = await createVerifiedShopper("member");
  await signIn(page, member, { next: `/designs/${designSlug}` });

  await page.getByTestId("design-toggle").click();
  await expect(formAlert(page).filter({ hasText: "Customer Plus" })).toBeVisible();
  expect((await api("POST", `/user/inspiration/designs/${designSlug}`, { token: member.token })).status).toBe(403);

  await page.goto("/en/subscriptions?for=customers");
  await page.getByTestId("plan-card").filter({ hasText: customerPlan.name }).getByRole("button", { name: "Send request" }).click();
  await expect(page).toHaveURL(/requested=customer/);
  await grantPending(member.email);

  await page.goto(`/en/designs/${designSlug}`);
  await page.getByTestId("design-toggle").click();
  await expect(page.getByTestId("design-toggle")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/en/account/inspiration");
  await expect(page.getByTestId("saved-designs")).toBeVisible();
  const overview = await api<{ customer: { entitled: boolean }; designer: { entitled: boolean } }>("GET", "/user/subscriptions", { token: member.token });
  expect(overview.data.customer.entitled).toBe(true);
  expect(overview.data.designer.entitled).toBe(false);
});

test("unverified customer can sign in but cannot request a subscription", async ({ page }) => {
  const plan = await activePlan("customer");
  const shopper = await createShopper("unverified");
  await signIn(page, shopper, { next: "/subscriptions?for=customers" });
  await expect(page.getByTestId("plan-card").filter({ hasText: plan.name })).toContainText("Verify your email address");
  const res = await api("POST", "/user/subscription-requests", { token: shopper.token, body: { plan_id: plan.id, billing_period: "monthly" } });
  expect(res.status).toBe(403);
  expect(res.code).toBe("email_unverified");
});
