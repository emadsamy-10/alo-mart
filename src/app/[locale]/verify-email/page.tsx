import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/features/account/ui/AuthShell";
import { Notice } from "@/features/account/ui/fields";
import { VerifyEmail } from "@/features/account/ui/VerifyEmail";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/verify-email">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Auth" });
  return { ...pageMetadata({ locale, path: "/verify-email", title: t("verify.title"), description: t("verify.title"), noindex: true }), referrer: "no-referrer" };
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const token = typeof query.token === "string" && /^[A-Za-z0-9]{64}$/.test(query.token) ? query.token : null;
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("verify.title")}>
      {token ? <VerifyEmail token={token} /> : <Notice tone="warning">{t("verify.invalid.body")}</Notice>}
    </AuthShell>
  );
}
