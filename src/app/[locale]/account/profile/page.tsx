import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { ProfileForm } from "@/features/account/ui/AccountForms";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/profile">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/profile", "profile");
}

export default async function Page({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/profile");
  if (!customer) return <AccountUnavailable retryHref="/account/profile" />;
  const t = await getTranslations("Account");

  return (
    <div className="space-y-6">
      <AccountHeading title={t("titles.profile")} intro={t("profile.intro")} />
      <AccountSection title={t("profile.details")}>
        <ProfileForm customer={customer} />
      </AccountSection>
      <AccountSection title={t("profile.contact")} description={t("profile.contactIntro")}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">{t("profile.email")}</dt>
            <dd className="mt-0.5 font-semibold break-all">{customer.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("profile.phone")}</dt>
            <dd className="mt-0.5 font-semibold" dir="ltr">
              {customer.phone ?? "—"}
            </dd>
          </div>
        </dl>
        <Link href="/account/security" className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text hover:underline">
          {t("profile.manageContact")}
        </Link>
      </AccountSection>
    </div>
  );
}
