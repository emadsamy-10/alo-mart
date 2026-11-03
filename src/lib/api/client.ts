import "server-only";
import type { z } from "zod";
import { env } from "@/lib/env";

/**
 * The single gateway to the ALO MART API. Server-side only: public catalog
 * reads, never credentials. Every call:
 *   - sends the UI locale as Accept-Language (the API localizes names by it),
 *   - is bounded by a timeout,
 *   - unwraps the `{ status, message, data }` envelope,
 *   - validates `data` against a schema at the boundary,
 *   - returns a discriminated result instead of throwing, so one failing
 *     section never blanks the whole page and a failure is distinguishable
 *     from a genuinely empty catalog.
 *
 * Caching: Next's fetch cache keys on URL + method + headers, so responses
 * for different markets (query string) and locales (Accept-Language) can never
 * be served for one another. No cookies or Authorization headers are sent, so
 * nothing user-specific can enter the shared cache.
 */

export type ApiErrorKind = "not_found" | "validation" | "network" | "timeout" | "server" | "invalid_response";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  kind: ApiErrorKind;
  status?: number;
  message?: string;
  /** Field errors of a 422 (`validation`), keyed as the API reports them (e.g. `attr.color`). */
  errors?: Record<string, string[]>;
}

/** A query value: scalars are set once, arrays append the key once per value (`brand_id[]=1&brand_id[]=2`). */
export type QueryValue = string | number | undefined | null | readonly (string | number)[];

export interface ApiRequestOptions {
  locale: string;
  query?: Record<string, QueryValue>;
  /** Seconds the response may be reused from the data cache. */
  revalidate: number;
  tags?: string[];
}

export function buildApiUrl(path: string, query?: ApiRequestOptions["query"]): string {
  const url = new URL(`${env.apiBaseUrl}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, String(item));
    } else if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

interface Envelope {
  status?: unknown;
  message?: unknown;
  data?: unknown;
  errors?: unknown;
}

function fieldErrors(value: unknown): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) out[key] = messages.filter((m): m is string => typeof m === "string");
  }
  return out;
}

export async function apiGet<S extends z.ZodType>(
  path: string,
  schema: S,
  options: ApiRequestOptions,
): Promise<ApiResult<z.output<S>>> {
  const url = buildApiUrl(path, options.query);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": options.locale },
      signal: AbortSignal.timeout(env.apiTimeoutMs),
      next: { revalidate: options.revalidate, tags: options.tags },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    logFailure(url, timedOut ? "timeout" : "network", error);
    return { ok: false, error: { kind: timedOut ? "timeout" : "network" } };
  }

  let body: Envelope | null = null;
  try {
    body = (await response.json()) as Envelope;
  } catch {
    body = null;
  }

  if (!response.ok || body?.status === false) {
    const kind: ApiErrorKind = response.status === 404 ? "not_found" : response.status === 422 ? "validation" : "server";
    const message = typeof body?.message === "string" ? body.message : undefined;
    if (kind === "server") logFailure(url, kind, `${response.status} ${message ?? ""}`);
    const errors = kind === "validation" ? fieldErrors(body?.errors) : undefined;
    return { ok: false, error: { kind, status: response.status, message, ...(errors ? { errors } : {}) } };
  }

  const parsed = schema.safeParse(body?.data);
  if (!parsed.success) {
    logFailure(url, "invalid_response", parsed.error.issues.slice(0, 3));
    return { ok: false, error: { kind: "invalid_response", status: response.status } };
  }

  return { ok: true, data: parsed.data };
}

function logFailure(url: string, kind: ApiErrorKind, detail: unknown) {
  console.error(`[api] ${kind} ${url}`, detail);
}
