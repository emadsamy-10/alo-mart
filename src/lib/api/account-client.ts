import "server-only";
import type { z } from "zod";
import { env } from "@/lib/env";
import { buildApiUrl, type ApiError, type ApiErrorKind, type QueryValue } from "./client";

/**
 * The gateway for CUSTOMER-SPECIFIC API calls (auth, profile, addresses,
 * orders, account cart/wishlist). Separate from apiGet() on purpose:
 *
 *   - never cached: `cache: "no-store"`, so one customer's data can never be
 *     served to another from Next's shared data cache;
 *   - the Sanctum token comes from the httpOnly session cookie on the server
 *     (see features/account/session.ts) and is sent only as a Bearer header —
 *     it never reaches browser JavaScript;
 *   - request bodies, tokens and responses are never logged (only method,
 *     path and status — a path never contains a secret here).
 *
 * Results are the same discriminated union as apiGet(), plus `unauthorized`,
 * `forbidden`, `rate_limited` and `conflict` kinds so pages and forms can
 * react precisely (sign the customer out, show "try again later"…).
 */

export type AccountErrorKind = ApiErrorKind | "unauthorized" | "forbidden" | "rate_limited" | "conflict" | "gone" | "bad_request";

export interface AccountError extends Omit<ApiError, "kind"> {
  kind: AccountErrorKind;
  /** Machine-readable reason from the API (`code`), e.g. verification_expired, reset_invalid. */
  code?: string;
}

export type AccountResult<T> = { ok: true; data: T; message?: string } | { ok: false; error: AccountError };

export interface AccountRequest {
  locale: string;
  token?: string | null;
  query?: Record<string, QueryValue>;
  /** JSON body, or FormData for file uploads. */
  body?: unknown;
  /** The shopper's IP, forwarded as X-Forwarded-For (per-shopper rate limits). */
  clientIp?: string | null;
}

const KIND_BY_STATUS: Record<number, AccountErrorKind> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  410: "gone",
  422: "validation",
  429: "rate_limited",
};

function fieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) out[key] = messages.filter((m): m is string => typeof m === "string");
  }
  return out;
}

export async function apiAccount<S extends z.ZodType>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  schema: S,
  request: AccountRequest,
): Promise<AccountResult<z.output<S>>> {
  const url = buildApiUrl(path, request.query);
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": request.locale };
  if (request.token) headers.Authorization = `Bearer ${request.token}`;
  if (request.clientIp) headers["X-Forwarded-For"] = request.clientIp;

  let body: BodyInit | undefined;
  if (request.body instanceof FormData) {
    body = request.body;
  } else if (request.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(request.body);
  }

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, cache: "no-store", signal: AbortSignal.timeout(env.apiTimeoutMs) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    log(method, url, timedOut ? "timeout" : "network");
    return { ok: false, error: { kind: timedOut ? "timeout" : "network" } };
  }

  let json = null as { status?: unknown; message?: unknown; data?: unknown; errors?: unknown; code?: unknown } | null;
  try {
    json = (await response.json()) as typeof json;
  } catch {
    json = null;
  }
  const message = typeof json?.message === "string" ? json.message : undefined;

  if (!response.ok || json?.status === false) {
    const kind = KIND_BY_STATUS[response.status] ?? "server";
    if (kind === "server") log(method, url, `server ${response.status}`);
    const errors = fieldErrors(json?.errors);
    const code = typeof json?.code === "string" ? json.code : undefined;
    return { ok: false, error: { kind, status: response.status, message, ...(errors ? { errors } : {}), ...(code ? { code } : {}) } };
  }

  const parsed = schema.safeParse(json?.data);
  if (!parsed.success) {
    log(method, url, "invalid_response");
    return { ok: false, error: { kind: "invalid_response", status: response.status } };
  }
  return { ok: true, data: parsed.data, message };
}

function log(method: string, url: string, what: string) {
  // The URL path only: never the query of a customer request, never a body or token.
  console.error(`[api:account] ${what} ${method} ${new URL(url).pathname}`);
}
