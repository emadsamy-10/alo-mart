import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, Trash2, Undo2 } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { deleteDesignAction, submitDesignAction, withdrawDesignAction } from "@/features/designers/actions";
import { getDesignCategories, getOwnDesign, getStudio } from "@/features/designers/api";
import { ActionButton, ConfirmAction } from "@/features/designers/ui/ConfirmAction";
import { DesignForm, MediaManager } from "@/features/designers/ui/DesignEditor";
import { designTone, StatusBadge } from "@/features/designers/ui/StatusBadge";
import { StudioNav } from "@/features/designers/ui/StudioNav";
import { Link, redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/designer/designs/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  return accountMetadata(locale, `/account/designer/designs/${id}`, "editDesign");
}

/** Edit a design: details, ordered photos, videos, review submission and deletion. */
export default async function EditDesignPage({ params, searchParams }: Props) {
  const { locale, id: raw } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const path = `/account/designer/designs/${id}`;
  const customer = await requireCustomer(locale, path);
  if (!customer) return <AccountUnavailable retryHref={path} />;
  const [studio, design, categories] = await Promise.all([getStudio(locale, path), getOwnDesign(locale, id), getDesignCategories(locale)]);
  if (studio.ok && !studio.data.profile) redirect({ href: "/account/designer", locale });
  if (!design.ok && design.error.kind === "not_found") notFound();
  if (!studio.ok || !design.ok || !categories.ok) return <AccountUnavailable retryHref={path} />;
  const sp = await searchParams;
  const t = await getTranslations("Designers.studio");
  const d = design.data;
  const s = studio.data;

  const blockers: string[] = [];
  if (!s.email_verified) blockers.push(t("needVerify"));
  if (s.profile?.status !== "approved") blockers.push(t("needApproval"));
  if (!d.limits.entitled) blockers.push(t("needPlan"));
  if (!d.images.length) blockers.push(t("needPhoto"));
  const canSubmit = ["draft", "rejected", "archived"].includes(d.status);
  // "Published" is only live while the designer is publicly visible (approved + active Designer subscription).
  const live = d.status === "published" && s.publicly_visible;

  return (
    <div className="space-y-6">
      <Link href="/account/designer/designs" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
        {t("back")}
      </Link>
      <AccountHeading title={d.title} />
      <StudioNav current="designs" />
      {sp.created ? <Notice>{t("created")}</Notice> : null}

      <AccountSection title={t("submitTitle")}>
        <div className="space-y-4" data-testid="review-panel">
          <p className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={designTone(d.status)}>{t(`designStatus.${d.status}`)}</StatusBadge>
            {live ? (
              <Link href={`/designs/${d.slug}`} className="text-sm font-semibold text-brand-text hover:underline">
                {t("viewPublic2")}
              </Link>
            ) : null}
          </p>
          {d.moderation_reason ? <p className="text-sm">{t("reason", { reason: d.moderation_reason })}</p> : null}
          {live ? <Notice tone="warning">{t("editPublishedWarning")}</Notice> : null}
          {d.status === "published" && !live ? <Notice tone="info">{t("publishedHidden")}</Notice> : null}
          {d.status === "pending_review" ? (
            <>
              <Notice tone="info">{t("lockedWhileReview")}</Notice>
              <ActionButton action={withdrawDesignAction} fields={{ design_id: d.id }} testId="withdraw-design">
                <Undo2 className="size-4.5" aria-hidden />
                {t("withdraw")}
              </ActionButton>
            </>
          ) : null}
          {canSubmit ? (
            <>
              <p className="text-sm text-muted-foreground">{t("submitHint")}</p>
              {blockers.length ? (
                <ul className="list-disc space-y-1 ps-5 text-sm" data-testid="submit-blockers">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              <ActionButton action={submitDesignAction} fields={{ design_id: d.id }} variant="brand" testId="submit-design">
                <Send className="size-4.5" aria-hidden />
                {t("submit")}
              </ActionButton>
            </>
          ) : null}
        </div>
      </AccountSection>

      <AccountSection title={t("nav.designs")}>
        <DesignForm design={d} categories={categories.data} />
      </AccountSection>

      <AccountSection title={`${t("photos")} · ${t("videos")}`}>
        <MediaManager design={d} limits={d.limits} />
      </AccountSection>

      {d.status !== "pending_review" ? (
        <ConfirmAction
          action={deleteDesignAction}
          fields={{ design_id: d.id }}
          trigger={
            <>
              <Trash2 className="size-4.5" aria-hidden />
              {t("delete")}
            </>
          }
          question={t("deleteConfirm")}
          confirmLabel={t("confirmDelete")}
          keepLabel={t("cancel")}
          testId="delete-design"
        />
      ) : null}
    </div>
  );
}
