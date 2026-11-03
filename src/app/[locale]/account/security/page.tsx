import type { Metadata } from "next";
import { CheckCircle2, MailWarning } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getSessions, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { ChangeEmailForm, ChangePasswordForm, ChangePhoneForm, SessionsList } from "@/features/account/ui/AccountForms";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { Notice } from "@/features/account/ui/fields";
import { ResendVerificationForm } from "@/features/account/ui/VerifyEmail";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/security">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/security", "security");
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/security");
  if (!customer) return <AccountUnavailable retryHref="/account/security" />;
  const [t, sessions, query] = await Promise.all([getTranslations("Account"), getSessions(locale), searchParams]);
  const count = typeof query.count === "string" && /^\d{1,4}$/.test(query.count) ? Number(query.count) : 0;
  const sessionNotice = query.sessions === "revoked" ? t("security.sessionRevoked") : query.sessions === "others" ? t("security.othersRevoked", { count }) : null;
  const verified = !!customer.email_verified_at;

  return (
    <div className="space-y-6">
      <AccountHeading title={t("titles.security")} intro={t("security.intro")} />

      <AccountSection title={t("security.emailTitle")} id="email">
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3" data-testid="verification-status">
          {verified ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <MailWarning className="size-5 text-warning" aria-hidden />}
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold break-all">{customer.email}</span>
            <span className="ms-2 text-muted-foreground">{verified ? t("security.verified") : t("security.unverified")}</span>
          </p>
          {verified ? null : <ResendVerificationForm compact />}
        </div>
        <ChangeEmailForm email={customer.email} />
      </AccountSection>

      <AccountSection title={t("security.passwordTitle")} id="password">
        <ChangePasswordForm />
      </AccountSection>

      <AccountSection title={t("security.phoneTitle")} description={t("security.phoneIntro")} id="phone">
        <ChangePhoneForm phone={customer.phone} />
      </AccountSection>

      <AccountSection title={t("security.sessionsTitle")} description={t("security.sessionsIntro")} id="sessions">
        <div className="space-y-4">
          {sessionNotice ? <Notice>{sessionNotice}</Notice> : null}
          {sessions.ok ? <SessionsList sessions={sessions.data} /> : <p className="text-sm text-danger">{t("overview.unavailable")}</p>}
        </div>
      </AccountSection>
    </div>
  );
}
