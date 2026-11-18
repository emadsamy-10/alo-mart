import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { getStudio } from "@/features/designers/api";
import { profileTone, StatusBadge } from "@/features/designers/ui/StatusBadge";
import { DesignerProfileForm, ProfileImageForm, ResubmitForm } from "@/features/designers/ui/StudioForms";
import { StudioNav } from "@/features/designers/ui/StudioNav";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/designer">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/designer", "designer");
}

/**
 * Become a designer (same account, no second sign-up) or, once applied, the
 * Studio profile tab: review status, public visibility, profile and images.
 */
export default async function DesignerStudioPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/designer");
  if (!customer) return <AccountUnavailable retryHref="/account/designer" />;
  const studio = await getStudio(locale);
  if (!studio.ok) return <AccountUnavailable retryHref="/account/designer" />;
  const sp = await searchParams;
  const t = await getTranslations("Designers.studio");
  const { profile, publicly_visible: visible, email_verified: verified } = studio.data;

  if (!profile) {
    return (
      <div className="space-y-6">
        <AccountHeading title={t("applyTitle")} intro={t("applyIntro")} />
        {!verified ? <Notice tone="info">{t("applyVerifyNote")}</Notice> : null}
        <AccountSection title={t("applyTitle")}>
          <DesignerProfileForm profile={null} />
        </AccountSection>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountHeading title={t("title")} />
      <StudioNav current="profile" />
      {sp.applied ? <Notice>{t("applied")}</Notice> : null}
      {sp.resubmitted ? <Notice>{t("resubmitted")}</Notice> : null}

      <AccountSection title={t("statusLabel")}>
        <div className="space-y-3" data-testid="designer-status">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={profileTone(profile.status)}>{t(`status.${profile.status}`)}</StatusBadge>
            <span className="text-sm text-muted-foreground">{t(`statusText.${profile.status}`)}</span>
          </p>
          {profile.review_reason ? <p className="text-sm">{t("reason", { reason: profile.review_reason })}</p> : null}
          <p className="text-sm" data-testid="designer-visibility">
            {visible ? t("visible") : profile.status === "approved" ? t("hiddenNoPlan") : t("hiddenPending")}
          </p>
          <div className="flex flex-wrap gap-2">
            {visible ? (
              <Link href={`/designers/${profile.slug}`} className={buttonClass({ variant: "outline" })}>
                {t("viewPublic")}
              </Link>
            ) : null}
            {!visible && profile.status !== "suspended" && profile.status !== "rejected" ? (
              <Link href="/subscriptions?for=designers" className={buttonClass({ variant: "brand" })}>
                {t("planCta")}
              </Link>
            ) : null}
          </div>
          {profile.status === "rejected" ? <ResubmitForm /> : null}
        </div>
      </AccountSection>

      <AccountSection title={t("nav.profile")}>
        <DesignerProfileForm profile={profile} />
      </AccountSection>

      <AccountSection title={t("images")}>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
          <ProfileImageForm slot="avatar" url={profile.avatar_url} />
          <ProfileImageForm slot="cover" url={profile.cover_url} />
        </div>
      </AccountSection>
    </div>
  );
}
