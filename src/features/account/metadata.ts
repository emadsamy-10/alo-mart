import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

/** Personal pages: never indexed, never shared as a referrer. */
export async function accountMetadata(locale: Locale, path: string, titleKey: "overview" | "orders" | "addresses" | "profile" | "security" | "order" | "newAddress" | "editAddress"): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Account.titles" });
  return { ...pageMetadata({ locale, path, title: t(titleKey), description: t("description"), noindex: true }), referrer: "strict-origin" };
}
