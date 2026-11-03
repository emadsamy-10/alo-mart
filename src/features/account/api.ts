import "server-only";
import { redirect } from "@/lib/i18n/navigation";
import { apiGet } from "@/lib/api/client";
import type { AccountResult } from "@/lib/api/account-client";
import type { Locale } from "@/lib/i18n/routing";
import { loginHref } from "./redirect";
import { addressSchema, addressesSchema, orderPageSchema, orderSchema, placesSchema, sessionsSchema } from "./schemas";
import { accountCall, getCurrentUser } from "./session";
import type { Customer } from "./schemas";

/**
 * Protected pages call this first. A guest is sent to sign-in with a safe
 * return path; an API outage returns null so the page renders an error state
 * (never a fake signed-out view). This is UX only — the API itself refuses
 * every /v1/user/* call without a valid token.
 */
export async function requireCustomer(locale: string, path: string): Promise<Customer | null> {
  const current = await getCurrentUser(locale);
  if (current.status === "guest") redirect({ href: loginHref(path), locale: locale as Locale });
  return current.status === "signed_in" ? current.user : null;
}

/** A 401 on an account read means the session just ended: back to sign-in. */
function signedOutGuard<T>(result: AccountResult<T>, locale: string, path: string): AccountResult<T> {
  if (!result.ok && result.error.kind === "unauthorized") redirect({ href: loginHref(path), locale: locale as Locale });
  return result;
}

export async function getSessions(locale: string) {
  return signedOutGuard(await accountCall("GET", "/user/auth/sessions", sessionsSchema, { locale }), locale, "/account/security");
}

export async function getAddresses(locale: string) {
  return signedOutGuard(await accountCall("GET", "/user/addresses", addressesSchema, { locale }), locale, "/account/addresses");
}

export async function getAddress(locale: string, id: number) {
  return signedOutGuard(await accountCall("GET", `/user/addresses/${id}`, addressSchema, { locale }), locale, `/account/addresses/${id}/edit`);
}

export async function getOrders(locale: string, page: number) {
  return signedOutGuard(
    await accountCall("GET", "/user/orders", orderPageSchema, { locale, query: { page, per_page: 10 } }),
    locale,
    page > 1 ? `/account/orders?page=${page}` : "/account/orders",
  );
}

export async function getOrder(locale: string, id: string) {
  return signedOutGuard(await accountCall("GET", `/user/orders/${id}`, orderSchema, { locale }), locale, `/account/orders/${id}`);
}

/* Public geography (cacheable: not customer data). */
export function getCountries(locale: string) {
  return apiGet("/countries", placesSchema, { locale, revalidate: 3600, tags: ["geography"] });
}
export function getRegions(locale: string, countryId: number) {
  return apiGet(`/countries/${countryId}/regions`, placesSchema, { locale, revalidate: 3600, tags: ["geography"] });
}
export function getCities(locale: string, regionId: number) {
  return apiGet(`/regions/${regionId}/cities`, placesSchema, { locale, revalidate: 3600, tags: ["geography"] });
}
