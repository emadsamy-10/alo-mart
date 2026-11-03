import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthShell } from "@/features/account/ui/AuthShell";
import { ForgotPasswordForm } from "@/features/account/ui/AuthForms";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/forgot-password">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Auth" });
  return pageMetadata({ locale, path: "/forgot-password", title: t("forgot.title"), description: t("forgot.intro"), noindex: true });
}

export default async function Page({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("forgot.title")} intro={t("forgot.intro")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
