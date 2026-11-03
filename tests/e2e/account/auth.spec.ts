import { ACCOUNT_E2E, PASSWORD, api, consoleErrors, createShopper, expect, formAlert, localDb, mailCount, mailLink, mailSubjects, sessionCookie, sessionToken, signIn, statusWith, test, uniqueEmail, uniquePhone } from "./helpers";

/**
 * Registration, sign-in/out, password recovery and email verification in a
 * real browser against the production build and a LOCAL backend (real API,
 * real mail via the local log transport). Desktop project only: the mobile
 * project covers layout/navigation in shop.spec.ts.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

test.describe("registration", () => {
  test("01 register → account overview, verification email, signed-in header", async ({ page }) => {
    const errors = consoleErrors(page);
    const email = uniqueEmail("reg");
    await page.goto("/en/register");
    const form = page.getByTestId("register-form");
    await form.getByLabel("Full name").fill("Mona Adel");
    await form.getByLabel("Email address").fill(email);
    await form.getByLabel("Mobile number").fill(uniquePhone());
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form.getByLabel("Confirm password").fill(PASSWORD);
    await form.getByRole("button", { name: "Create account" }).click();

    await expect(page).toHaveURL(/\/en\/account\?welcome=1$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hello, Mona" })).toBeVisible();
    await expect(page.getByText(`We sent a confirmation link to ${email}`)).toBeVisible();
    await expect(page.getByTestId("verify-banner")).toBeVisible();
    await expect(page.getByTestId("account-menu")).toBeVisible();
    expect(await mailLink(email, "verify-email")).toMatch(/\/en\/verify-email\?token=[A-Za-z0-9]{64}$/);
    expect(errors).toEqual([]);
  });

  test("02 mismatched passwords: field error, other values kept, passwords never echoed", async ({ page }) => {
    await page.goto("/en/register");
    const form = page.getByTestId("register-form");
    await form.getByLabel("Full name").fill("Mona Adel");
    await form.getByLabel("Email address").fill("keep@alo-mart.test");
    await form.getByLabel("Mobile number").fill("01000000000");
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form.getByLabel("Confirm password").fill("different-pass-1");
    await form.getByRole("button", { name: "Create account" }).click();

    const confirm = form.getByLabel("Confirm password");
    await expect(confirm).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByText("The passwords do not match.")).toBeVisible();
    await expect(form.getByLabel("Email address")).toHaveValue("keep@alo-mart.test");
    await expect(form.getByLabel("Full name")).toHaveValue("Mona Adel");
    await expect(form.getByLabel("Password", { exact: true })).toHaveValue("");
  });

  test("03 an email that already has an account is rejected on the email field", async ({ page }) => {
    const existing = await createShopper("dupe");
    await page.goto("/en/register");
    const form = page.getByTestId("register-form");
    await form.getByLabel("Full name").fill("Someone Else");
    await form.getByLabel("Email address").fill(existing.email);
    await form.getByLabel("Mobile number").fill(uniquePhone());
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form.getByLabel("Confirm password").fill(PASSWORD);
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(form.getByLabel("Email address")).toHaveAttribute("aria-invalid", "true");
    await expect(formAlert(page).first()).toContainText("Please check the highlighted fields.");
    await expect(page).toHaveURL(/\/en\/register$/);
  });

  test("04 empty submission shows the API's required-field errors", async ({ page }) => {
    await page.goto("/en/register");
    const form = page.getByTestId("register-form");
    await form.getByRole("button", { name: "Create account" }).click();
    for (const label of ["Full name", "Email address", "Mobile number"]) {
      await expect(form.getByLabel(label)).toHaveAttribute("aria-invalid", "true");
    }
  });

  test("05 registration returns to a safe ?next destination", async ({ page }) => {
    await page.goto("/en/register?next=%2Fwishlist");
    const form = page.getByTestId("register-form");
    await form.getByLabel("Full name").fill("Next Shopper");
    await form.getByLabel("Email address").fill(uniqueEmail("next"));
    await form.getByLabel("Mobile number").fill(uniquePhone());
    await form.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await form.getByLabel("Confirm password").fill(PASSWORD);
    await form.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/en\/wishlist$/);
  });
});

test.describe("sign in and sign out", () => {
  test("06 wrong password: one generic message, email kept", async ({ page }) => {
    const shopper = await createShopper("wrong");
    await signIn(page, { email: shopper.email, password: "not-the-password" });
    await expect(formAlert(page)).toHaveText("The email address or password is not correct.");
    await expect(page.getByTestId("login-form").getByLabel("Email address")).toHaveValue(shopper.email);
    expect(await sessionCookie(page)).toBeUndefined();
  });

  test("07 session cookie: httpOnly, SameSite=Lax, lifetime follows Keep me signed in", async ({ page, context }) => {
    const shopper = await createShopper("cookie");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    const short = await sessionCookie(page);
    expect(short).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    const hours = (short!.expires * 1000 - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11);
    expect(hours).toBeLessThan(12.1);

    await context.clearCookies();
    await signIn(page, shopper, { remember: true });
    await expect(page).toHaveURL(/\/en\/account$/);
    const days = ((await sessionCookie(page))!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThan(30.1);
  });

  test("08 a protected page sends a guest to sign-in and back again", async ({ page }) => {
    const shopper = await createShopper("back");
    await page.goto("/en/account/orders");
    await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount%2Forders$/);
    await expect(page.getByText("Sign in to continue.")).toBeVisible();
    await signIn(page, shopper, { next: "/account/orders" });
    await expect(page).toHaveURL(/\/en\/account\/orders$/);
    await expect(page.getByRole("heading", { level: 1, name: "My orders" })).toBeVisible();
  });

  test("09 open redirects are refused (absolute, protocol-relative, encoded)", async ({ page, context }) => {
    const shopper = await createShopper("redir");
    for (const next of ["https://evil.example/x", "//evil.example", "%2F%2Fevil.example", "/\\evil.example"]) {
      await context.clearCookies();
      await signIn(page, shopper, { next });
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/en\/account$/);
    }
  });

  test("10 signed-in visitors skip the sign-in and register pages", async ({ page }) => {
    const shopper = await createShopper("skip");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    await page.goto("/en/login");
    await expect(page).toHaveURL(/\/en\/account$/);
    await page.goto("/en/register?next=%2Fcart");
    await expect(page).toHaveURL(/\/en\/cart$/);
  });

  test("11 sign out revokes the token, clears the cookie, protects pages again", async ({ page }) => {
    const shopper = await createShopper("out");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    const token = await sessionToken(page);
    await page.getByTestId("sign-out").first().click();
    await expect(page).toHaveURL(/\/en\/?\?signed_out=1$/);
    expect(await sessionCookie(page)).toBeUndefined();
    await expect(page.getByTestId("header-sign-in")).toBeVisible();
    expect((await api("GET", "/user/auth/me", { token })).status).toBe(401);
    await page.goto("/en/account");
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("12 the token never reaches browser storage, script-readable cookies or the HTML", async ({ page }) => {
    const shopper = await createShopper("leak");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    const token = await sessionToken(page);
    expect(token).toMatch(/^d+|/);
    const exposed = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, cookie: document.cookie }));
    expect(exposed).not.toContain(token.split("|")[1]);
    expect(await page.content()).not.toContain(token.split("|")[1]);
    await page.goto("/en/account/security");
    expect(await page.content()).not.toContain(token.split("|")[1]);
  });

  test("13 a deactivated account is signed out and cannot sign in", async ({ page }) => {
    const shopper = await createShopper("inactive");
    await signIn(page, shopper);
    await expect(page).toHaveURL(/\/en\/account$/);
    localDb(`DB::table('users')->where('email', '${shopper.email}')->update(['is_active' => false]);`);
    // The server answers with a redirect to sign-in, which may arrive mid-navigation (goto then reports ERR_ABORTED).
    await page.goto("/en/account").catch(() => undefined);
    await expect(page).toHaveURL(/\/en\/login\?next=%2Faccount$|\/en\/login$/);
    await signIn(page, shopper);
    await expect(formAlert(page)).toHaveText("This account is not active. Please contact ALO MART.");
  });
});

test.describe("password recovery", () => {
  test("14 unknown and known emails get the same answer (no account enumeration)", async ({ page }) => {
    const shopper = await createShopper("enum");
    const messages: string[] = [];
    for (const email of [uniqueEmail("nobody"), shopper.email]) {
      await page.goto("/en/forgot-password");
      await page.getByTestId("forgot-form").getByLabel("Email address").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      const status = statusWith(page, "If an account exists");
      await expect(status).toBeVisible();
      messages.push((await status.textContent()) ?? "");
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain("If an account exists for this address");
  });

  test("15 reset by email link: new password works, old one fails, every session ends", async ({ page }) => {
    const shopper = await createShopper("reset");
    const other = await api<{ token: string }>("POST", "/user/auth/login", { body: { email: shopper.email, password: PASSWORD } });
    await page.goto("/en/forgot-password");
    await page.getByTestId("forgot-form").getByLabel("Email address").fill(shopper.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(statusWith(page, "If an account exists")).toBeVisible();

    const link = await mailLink(shopper.email, "reset-password");
    expect(mailSubjects(shopper.email).some((s) => /reset/i.test(s))).toBe(true);
    await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    const form = page.getByTestId("reset-form");
    await expect(form.getByLabel("Email address")).toHaveValue(shopper.email);
    await form.getByLabel("New password").fill("Brand-new-pass-2");
    await form.getByLabel("Confirm password").fill("Brand-new-pass-2");
    await form.getByRole("button", { name: "Save new password" }).click();

    await expect(page).toHaveURL(/\/en\/login\?reset=1$/);
    await expect(page.getByText("Your password was changed. Sign in with your new password.")).toBeVisible();
    expect((await api("GET", "/user/auth/me", { token: other.data.token })).status).toBe(401);
    await signIn(page, { email: shopper.email, password: PASSWORD });
    await expect(formAlert(page)).toHaveText("The email address or password is not correct.");
    await signIn(page, { email: shopper.email, password: "Brand-new-pass-2" });
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test("16 a used reset link is refused with a way to request a new one", async ({ page }) => {
    const shopper = await createShopper("reuse");
    await api("POST", "/user/auth/password/forgot", { body: { email: shopper.email } });
    const path = (await mailLink(shopper.email, "reset-password")).replace(/^https?:\/\/[^/]+/, "");
    for (const attempt of [1, 2]) {
      await page.goto(path);
      const form = page.getByTestId("reset-form");
      await form.getByLabel("New password").fill(`Another-pass-${attempt}x`);
      await form.getByLabel("Confirm password").fill(`Another-pass-${attempt}x`);
      await form.getByRole("button", { name: "Save new password" }).click();
      if (attempt === 1) await expect(page).toHaveURL(/\/en\/login\?reset=1$/);
    }
    await expect(formAlert(page)).toHaveText("This reset link is invalid or has expired.");
    await expect(page.getByRole("link", { name: "Request a new link" })).toBeVisible();
  });

  test("17 a reset page without a token explains and links to a new request", async ({ page }) => {
    await page.goto("/en/reset-password");
    await expect(page.getByText("This reset link is invalid or has expired.")).toBeVisible();
    await page.getByRole("link", { name: "Request a new link" }).click();
    await expect(page).toHaveURL(/\/en\/forgot-password$/);
    // Secret-bearing pages are never indexed and never leak the URL as a referrer.
    await page.goto("/en/reset-password?token=abcdefghijklmnopqrstuvwxyz&email=a%40b.c");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });

  test("18 repeated reset requests are rate limited with a clear message", async ({ page }) => {
    await page.goto("/en/forgot-password");
    const form = page.getByTestId("forgot-form");
    let limited = false;
    for (let i = 0; i < 7 && !limited; i++) {
      await form.getByLabel("Email address").fill(uniqueEmail("limit"));
      await form.getByRole("button", { name: "Send reset link" }).click();
      await expect(form.getByRole("button", { name: "Send reset link" })).toBeEnabled();
      limited = (await formAlert(page).filter({ hasText: "Too many attempts" }).count()) > 0;
    }
    expect(limited).toBe(true);
    await expect(formAlert(page)).toHaveText("Too many attempts. Please wait a minute and try again.");
  });
});

test.describe("email verification", () => {
  test("19 the emailed link verifies the address; security shows it confirmed", async ({ page }) => {
    const shopper = await createShopper("verify");
    const link = await mailLink(shopper.email, "verify-email");
    await signIn(page, shopper);
    await expect(page.getByTestId("verify-banner")).toBeVisible();
    await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
    await expect(page.getByTestId("verify-verified")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your email is confirmed" })).toBeVisible();
    await page.getByRole("link", { name: "Go to my account" }).click();
    await expect(page.getByTestId("verify-banner")).toHaveCount(0);
    await page.goto("/en/account/security");
    await expect(page.getByTestId("verification-status")).toContainText("Confirmed");
  });

  test("20 a reused, unknown or missing token is explained, never a crash", async ({ page }) => {
    const shopper = await createShopper("verify2");
    const path = (await mailLink(shopper.email, "verify-email")).replace(/^https?:\/\/[^/]+/, "");
    await page.goto(path);
    await expect(page.getByTestId("verify-verified")).toBeVisible();
    await page.goto(path);
    await expect(page.getByTestId("verify-invalid")).toBeVisible();
    await page.goto(`/en/verify-email?token=${"x".repeat(64)}`);
    await expect(page.getByTestId("verify-invalid")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to get a new link" })).toBeVisible();
    await page.goto("/en/verify-email");
    await expect(page.getByText("The link may be incomplete")).toBeVisible();
  });

  test("21 an expired link offers a fresh one; resend has a cooldown and replaces the link", async ({ page }) => {
    const shopper = await createShopper("expired");
    const first = (await mailLink(shopper.email, "verify-email")).replace(/^https?:\/\/[^/]+/, "");
    localDb(`DB::table('user_email_verification_tokens')->where('user_id', DB::table('users')->where('email', '${shopper.email}')->value('id'))->update(['expires_at' => now()->subHour(), 'created_at' => now()->subDay()]);`);
    await signIn(page, shopper);
    await page.goto(first);
    await expect(page.getByTestId("verify-expired")).toBeVisible();
    await expect(page.getByText("Confirmation links are valid for 24 hours.")).toBeVisible();

    const before = mailCount(shopper.email, "verify-email");
    await page.getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(statusWith(page, "A new confirmation link is on its way.")).toBeVisible();
    const second = (await mailLink(shopper.email, "verify-email", { after: before })).replace(/^https?:\/\/[^/]+/, "");
    expect(second).not.toBe(first);

    // Immediately again: the cooldown answers, nothing else is sent.
    await page.goto("/en/account");
    await page.getByTestId("verify-banner").getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(formAlert(page)).toHaveText("Please wait a minute before requesting another email.");
    expect(mailCount(shopper.email, "verify-email")).toBe(before + 1);

    await page.goto(second);
    await expect(page.getByTestId("verify-verified")).toBeVisible();
  });

  test("22 resend after verifying elsewhere says so and sends nothing", async ({ page }) => {
    const shopper = await createShopper("already");
    await signIn(page, shopper);
    await expect(page.getByTestId("verify-banner")).toBeVisible();
    // Verified in another tab / device.
    const path = (await mailLink(shopper.email, "verify-email")).replace(/^https?:\/\/[^/]+/, "");
    await api("POST", "/user/auth/email/verify", { body: { token: path.split("token=")[1] } });
    const before = mailCount(shopper.email, "verify-email");
    await page.getByTestId("verify-banner").getByRole("button", { name: "Send a new confirmation link" }).click();
    await expect(statusWith(page, "This email address was already verified.")).toBeVisible();
    expect(mailCount(shopper.email, "verify-email")).toBe(before);
  });
});
