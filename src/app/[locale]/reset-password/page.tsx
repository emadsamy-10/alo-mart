import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { AuthShell } from "@/features/account/ui/AuthShell";
import { ResetPasswordForm } from "@/features/account/ui/AuthForms";
import { Notice } from "@/features/account/ui/fields";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/reset-password">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Auth" });
  // The URL carries a secret: never index it, never send it as a referrer.
  return { ...pageMetadata({ locale, path: "/reset-password", title: t("reset.title"), description: t("reset.intro"), noindex: true }), referrer: "no-referrer" };
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const token = typeof query.token === "string" && /^[A-Za-z0-9]{20,200}$/.test(query.token) ? query.token : null;
  const email = typeof query.email === "string" && query.email.length <= 255 && query.email.includes("@") ? query.email : null;
  const t = await getTranslations("Auth");

  return (
    <AuthShell title={t("reset.title")} intro={token && email ? t("reset.intro") : undefined}>
      {token && email ? (
        <ResetPasswordForm token={token} email={email} />
      ) : (
        <div className="space-y-5">
          <Notice tone="warning">{t("reset.invalid")}</Notice>
          <Link href="/forgot-password" className={buttonClass({ variant: "brand", size: "lg" }, "w-full")}>
            {t("reset.requestNew")}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
