/**
 * Return-URL handling for sign-in (pure, unit-tested).
 *
 * `next` comes from the URL, so it is untrusted: only a same-site,
 * locale-less PATH is accepted. Anything that could leave the site —
 * `https://evil`, `//evil`, `/\evil`, `javascript:`, encoded variants,
 * control characters — falls back to the account page. Auth pages
 * themselves are never a destination (no login → login loops).
 */

const FALLBACK = "/account";
const AUTH_PAGES = /^\/(login|register|forgot-password|reset-password|verify-email)(\/|$|\?)/;
const LOCALE_PREFIX = /^\/(ar|en)(?=\/|$|\?)/;

export function safeNext(value: unknown, fallback = FALLBACK): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;

  let decoded = value;
  try {
    // Decode repeatedly so "%2F%2Fevil.com" cannot sneak past the checks.
    for (let i = 0; i < 3 && /%[0-9a-f]{2}/i.test(decoded); i++) decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (/[\u0000-\u001f\u007f\\]/.test(decoded)) return fallback;
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;

  // Resolve against a dummy origin: the result must stay on that origin.
  let url: URL;
  try {
    url = new URL(decoded, "https://storefront.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "https://storefront.invalid") return fallback;

  // Locale is applied by the router; strip one if the link carried it.
  const path = url.pathname.replace(LOCALE_PREFIX, "") || "/";
  const result = `${path}${url.search}`;
  if (AUTH_PAGES.test(result)) return fallback;
  return result;
}

/**
 * Where a new customer lands after registering: the page they were heading to, else the account
 * overview with a welcome that is truthful about the confirmation email (`emailSent` false = the
 * backend could not deliver it; undefined = an older backend that does not say).
 */
export function afterRegister(next: string, emailSent: boolean | undefined): string {
  if (next && next !== FALLBACK) return next;
  return emailSent === false ? "/account?welcome=unsent" : "/account?welcome=1";
}

/** `/login?next=…` for a protected path (path is the locale-less current path). */
export function loginHref(next?: string | null): string {
  const target = next ? safeNext(next, "") : "";
  return target && target !== FALLBACK ? `/login?next=${encodeURIComponent(target)}` : "/login";
}
