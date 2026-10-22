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

export type ApiErrorKind = "not_found" | "network" | "timeout" | "server" | "invalid_response";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { kind: ApiErrorKind; status?: number; message?: string } };

export interface ApiRequestOptions {
  locale: string;
  query?: Record<string, string | number | undefined | null>;
  /** Seconds the response may be reused from the data cache. */
  revalidate: number;
  tags?: string[];
}

export function buildApiUrl(path: string, query?: ApiRequestOptions["query"]): string {
  const url = new URL(`${env.apiBaseUrl}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

interface Envelope {
  status?: unknown;
  message?: unknown;
  data?: unknown;
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
    const kind: ApiErrorKind = response.status === 404 ? "not_found" : "server";
    const message = typeof body?.message === "string" ? body.message : undefined;
    if (kind !== "not_found") logFailure(url, kind, `${response.status} ${message ?? ""}`);
    return { ok: false, error: { kind, status: response.status, message } };
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
