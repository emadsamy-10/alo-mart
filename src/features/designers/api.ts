import "server-only";
import { apiGet, type ApiErrorKind } from "@/lib/api/client";
import type { AccountErrorKind, AccountResult } from "@/lib/api/account-client";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { loginHref } from "@/features/account/redirect";
import { accountCall } from "@/features/account/session";
import {
  categoriesSchema,
  designDetailSchema,
  designerDetailSchema,
  designerPageSchema,
  designPageSchema,
  historySchema,
  inspirationSchema,
  overviewSchema,
  ownDesignsSchema,
  ownDesignWithLimitsSchema,
  plansSchema,
  studioSchema,
} from "./schemas";

/*
 * Reads for designers, designs and plans are NOT cached (revalidate 0 /
 * no-store): an admin approval, moderation decision or subscription grant
 * happens in the Admin Dashboard, which cannot invalidate this site's cache,
 * and must show at once. Detail pages go through accountCall so a signed-in
 * viewer's token is sent (members-only details, follow/save state); the
 * token is optional there and the API answers guests too.
 */
const FRESH = { revalidate: 0 } as const;

/** Map an account-call failure on a PUBLIC page to the catalog error boundary's kinds. */
export function publicErrorKind(kind: AccountErrorKind): ApiErrorKind {
  return kind === "network" || kind === "timeout" || kind === "invalid_response" || kind === "not_found" || kind === "validation" ? kind : "server";
}

export type DesignListQuery = { q?: string; category?: string; media?: "video"; page?: number; designer?: string };

/** `revalidate` defaults to uncached; only the hourly sitemap passes its own cache lifetime. */
export function getDesigns(locale: string, query: DesignListQuery, revalidate = 0) {
  return apiGet("/designs", designPageSchema, { locale, revalidate, query: { ...query, per_page: revalidate ? 48 : 12 } });
}

export function getDesigners(locale: string, query: { q?: string; page?: number }, revalidate = 0) {
  return apiGet("/designers", designerPageSchema, { locale, revalidate, query: { ...query, per_page: revalidate ? 48 : 12 } });
}

export function getDesignCategories(locale: string) {
  return apiGet("/design-categories", categoriesSchema, { locale, revalidate: 3600 });
}

export function getDesign(locale: string, slug: string) {
  return accountCall("GET", `/designs/${encodeURIComponent(slug)}`, designDetailSchema, { locale });
}

export function getDesigner(locale: string, slug: string) {
  return accountCall("GET", `/designers/${encodeURIComponent(slug)}`, designerDetailSchema, { locale });
}

export function getPlans(locale: string, audience?: "designer" | "customer") {
  return apiGet("/user-subscription-plans", plansSchema, { locale, ...FRESH, query: { audience } });
}

/* ------------------------------------------------ signed-in customer reads */

function signedOutGuard<T>(result: AccountResult<T>, locale: string, path: string): AccountResult<T> {
  if (!result.ok && result.error.kind === "unauthorized") redirect({ href: loginHref(path), locale: locale as Locale });
  return result;
}

export async function getSubscriptionOverview(locale: string, back = "/account/subscription") {
  return signedOutGuard(await accountCall("GET", "/user/subscriptions", overviewSchema, { locale }), locale, back);
}

export async function getSubscriptionHistory(locale: string) {
  return signedOutGuard(await accountCall("GET", "/user/subscriptions/history", historySchema, { locale }), locale, "/account/subscription");
}

export async function getStudio(locale: string, back = "/account/designer") {
  return signedOutGuard(await accountCall("GET", "/user/designer", studioSchema, { locale }), locale, back);
}

export async function getOwnDesigns(locale: string) {
  return signedOutGuard(await accountCall("GET", "/user/designer/designs", ownDesignsSchema, { locale }), locale, "/account/designer/designs");
}

export async function getOwnDesign(locale: string, id: number) {
  return signedOutGuard(await accountCall("GET", `/user/designer/designs/${id}`, ownDesignWithLimitsSchema, { locale }), locale, `/account/designer/designs/${id}`);
}

export async function getInspiration(locale: string) {
  return signedOutGuard(await accountCall("GET", "/user/inspiration", inspirationSchema, { locale }), locale, "/account/inspiration");
}
