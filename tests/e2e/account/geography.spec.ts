import { ACCOUNT_E2E, createShopper, expect, localDb, signIn, test } from "./helpers";
import type { Page } from "@playwright/test";

/**
 * Cities and governorates managed in the Admin Dashboard reach the customer's address form at once
 * (real-customer QA, 2026-11-10: a new city stayed missing for up to an hour because the website kept
 * the geography lists in its server data cache). The city is created through the backend's own
 * CityService — what POST /admin/cities runs — in the disposable LOCAL database.
 */
test.skip(!ACCOUNT_E2E, "account E2E needs E2E_ACCOUNT=1 and a LOCAL backend (never staging)");
test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "desktop", "desktop flows"));

const SERVICE = "app(Modules\\Geography\\Services\\CityService::class)";
const GIZA = "DB::table('regions')->where('code','GIZ')->value('id')";

async function citiesFor(page: Page, region: string): Promise<string[]> {
  await page.goto("/en/account/addresses/new");
  await page.getByLabel("Country").selectOption("Egypt");
  await expect(page.getByLabel("Governorate / region")).toBeEnabled();
  await page.getByLabel("Governorate / region").selectOption(region);
  const city = page.getByLabel("City / district");
  await expect(city).toBeEnabled();
  return (await city.locator("option").allTextContents()).filter((name) => name !== "Choose…");
}

test.describe("geography from the admin reaches the address form", () => {
  test("91 a city created, renamed or deactivated in the admin is reflected at once", async ({ page }) => {
    const shopper = await createShopper("geo");
    await signIn(page, shopper);
    // A customer has already opened the form (the lists were fetched before the admin's change).
    const before = await citiesFor(page, "Giza");
    expect(before.length).toBeGreaterThan(0);

    const code = `GZ-T${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const name = `QA City ${code}`;
    const id = Number(localDb(`echo ${SERVICE}->create(['region_id' => ${GIZA}, 'name' => '${name}', 'code' => '${code}'])->id;`).trim().split("\n").pop());
    expect(id).toBeGreaterThan(0);
    try {
      // Created: listed under its governorate, and only there.
      expect(await citiesFor(page, "Giza")).toContain(name);
      expect(await citiesFor(page, "Cairo")).not.toContain(name);

      // Renamed.
      localDb(`${SERVICE}->update(Modules\\Geography\\Models\\City::find(${id}), ['name' => '${name} Renamed']);`);
      const renamed = await citiesFor(page, "Giza");
      expect(renamed).toContain(`${name} Renamed`);
      expect(renamed).not.toContain(name);

      // Deactivated: no longer offered.
      localDb(`${SERVICE}->update(Modules\\Geography\\Models\\City::find(${id}), ['is_active' => false]);`);
      expect(await citiesFor(page, "Giza")).not.toContain(`${name} Renamed`);
    } finally {
      localDb(`${SERVICE}->delete(Modules\\Geography\\Models\\City::find(${id}));`);
    }
  });
});
