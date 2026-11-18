import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/features/account/session";
import { AuthShell } from "@/features/account/ui/AuthShell";
import { VerifyEmail, VerifyResult } from "@/features/account/ui/VerifyEmail";
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
  const [t, current] = await Promise.all([getTranslations("Auth"), getCurrentUser(locale)]);
  const signedIn = current.status === "signed_in";
  return (
    <AuthShell title={t("verify.title")}>
      {signedIn && current.user.email_verified_at ? (
        // Already confirmed (e.g. reopening a used link): say so, and leave the link unused.
        <VerifyResult outcome={{ status: "already", signedIn: true }} />
      ) : token ? (
        <VerifyEmail token={token} />
      ) : (
        // Malformed or missing: the same answer as an unknown link, with a way to get a new one.
        <VerifyResult outcome={{ status: "invalid", signedIn }} />
      )}
    </AuthShell>
  );
}
