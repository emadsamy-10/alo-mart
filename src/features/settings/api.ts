import "server-only";
import { cache } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api/client";
import { lenientArray } from "@/lib/api/schemas";

/**
 * Public platform settings (`GET /settings`): key/value pairs the platform
 * admins maintain, e.g. `platform.support_email`. Only values present in the
 * API are ever shown — nothing is assumed when a key is missing.
 */
const settingSchema = z.object({ key: z.string(), value: z.unknown() });

export const getPublicSettings = cache(async (locale: string) =>
  apiGet("settings", lenientArray(settingSchema), { locale, revalidate: 600, tags: ["settings"] }),
);

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** The official customer-support email, when the platform publishes one. */
export async function getSupportEmail(locale: string): Promise<string | null> {
  const settings = await getPublicSettings(locale);
  if (!settings.ok) return null;
  const value = settings.data.find((s) => s.key === "platform.support_email")?.value;
  return typeof value === "string" && EMAIL.test(value.trim()) ? value.trim() : null;
}
