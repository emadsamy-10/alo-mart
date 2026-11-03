/**
 * The result every account form action returns to useActionState().
 * `fieldErrors` holds ONE message per field (the API's first, already in the
 * request language). `values` echoes back non-secret inputs so a failed
 * submission does not wipe the form (passwords are never echoed).
 */
export interface FormState {
  status: "idle" | "success" | "error";
  message?: string;
  /** API reason, e.g. verification_expired, resend_too_soon. */
  code?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export const IDLE: FormState = { status: "idle" };

/** API field keys → form field names (the API reports `phone`, the form may call it differently). */
export function firstErrors(errors: Record<string, string[]> | undefined, rename: Record<string, string> = {}): Record<string, string> | undefined {
  if (!errors) return undefined;
  const out: Record<string, string> = {};
  for (const [key, messages] of Object.entries(errors)) {
    if (messages[0]) out[rename[key] ?? key] = messages[0];
  }
  return Object.keys(out).length ? out : undefined;
}

export function text(form: FormData, name: string, max = 500): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Raw (untrimmed) secret, never echoed back. */
export function secret(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.slice(0, 200) : "";
}
