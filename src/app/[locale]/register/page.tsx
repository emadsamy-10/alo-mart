import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { safeNext } from "@/features/account/redirect";
import { getCurrentUser } from "@/features/account/session";
import { AuthShell } from "@/features/account/ui/AuthShell";
import { RegisterForm } from "@/features/account/ui/AuthForms";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/register">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Auth" });
  return pageMetadata({ locale, path: "/register", title: t("register.title"), description: t("register.intro"), noindex: true });
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNext(query.next, "") : "";
  if ((await getCurrentUser(locale)).status === "signed_in") redirect({ href: next || "/account", locale });

  const t = await getTranslations("Auth");
  return (
    <AuthShell title={t("register.title")} intro={t("register.intro")}>
      <RegisterForm next={next || undefined} />
    </AuthShell>
  );
}
