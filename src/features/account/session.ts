import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { apiAccount, type AccountRequest, type AccountResult } from "@/lib/api/account-client";
import type { z } from "zod";
import { customerSchema, type Customer } from "./schemas";

/**
 * The customer session lives in ONE httpOnly cookie holding the Sanctum token.
 *
 *   - httpOnly: browser JavaScript (and any injected script) cannot read it;
 *   - SameSite=Lax + Next's Server Action origin check: other sites cannot
 *     make the browser perform account mutations (CSRF);
 *   - Secure in production; path "/"; lifetime = the token's own expiry, so
 *     "remember me" and normal sessions end exactly when the API ends them.
 *
 * The token is never put in localStorage/sessionStorage, never in a URL,
 * never logged, never sent to the browser. Protection is enforced by the API
 * (every /v1/user/* call needs the Bearer token); the pages only reflect it.
 */
export const SESSION_COOKIE = "alo_session";

/** Fallback lifetime when the API reports no expiry (should not happen for customers). */
const DEFAULT_MAX_AGE = 60 * 60 * 12;

export async function readSessionToken(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && /^\d+\|[A-Za-z0-9]{20,}$/.test(value) ? value : null;
}

export async function writeSessionToken(token: string, expiresAt: string | null) {
  const expiry = expiresAt ? Date.parse(expiresAt) : NaN;
  const maxAge = Number.isFinite(expiry) ? Math.max(60, Math.floor((expiry - Date.now()) / 1000)) : DEFAULT_MAX_AGE;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
    priority: "high",
  });
}

export async function clearSessionToken() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/" });
}

/**
 * The shopper's address as the storefront server sees it, forwarded so the
 * API's per-IP rate limits apply per shopper (the API trusts it only from
 * the storefront's own servers — TRUSTED_PROXIES on the backend).
 */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim();
  return forwarded && /^[0-9a-fA-F:.]{3,45}$/.test(forwarded) ? forwarded : null;
}

/** An account API call with the current session token (when there is one). */
export async function accountCall<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  schema: S,
  request: Omit<AccountRequest, "token" | "clientIp">,
): Promise<AccountResult<z.output<S>>> {
  const [token, ip] = await Promise.all([readSessionToken(), clientIp()]);
  return apiAccount(method, path, schema, { ...request, token, clientIp: ip });
}

export type CurrentUser = { status: "signed_in"; user: Customer } | { status: "guest" } | { status: "unavailable" };

/**
 * Who is signed in, once per request (React cache). A 401 means the token is
 * expired/revoked/deactivated → guest (the stale cookie is ignored; it is
 * cleared on the next mutation or sign-out). An API outage is reported as
 * "unavailable" so a page can show an error instead of pretending the
 * customer is signed out.
 */
export const getCurrentUser = cache(async (locale: string): Promise<CurrentUser> => {
  const token = await readSessionToken();
  if (!token) return { status: "guest" };
  const result = await apiAccount("GET", "/user/auth/me", customerSchema, { locale, token, clientIp: await clientIp() });
  if (result.ok) return { status: "signed_in", user: result.data };
  if (result.error.kind === "unauthorized" || result.error.kind === "forbidden") return { status: "guest" };
  return { status: "unavailable" };
});
