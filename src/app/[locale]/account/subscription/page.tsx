import type { Metadata } from "next";
import { Info } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { cancelSubscriptionAction, withdrawSubscriptionRequestAction } from "@/features/designers/actions";
import { getSubscriptionHistory, getSubscriptionOverview } from "@/features/designers/api";
import type { AudienceState } from "@/features/designers/schemas";
import { ActionButton, ConfirmAction } from "@/features/designers/ui/ConfirmAction";
import { StatusBadge, type BadgeTone } from "@/features/designers/ui/StatusBadge";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/subscription">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/subscription", "subscription");
}

function statusOf(state: AudienceState): { key: string; tone: BadgeTone } {
  const s = state.subscription;
  if (!s) return { key: "none", tone: "neutral" };
  if (s.status === "active" && s.cancel_at_period_end) return { key: "cancelling", tone: "warning" };
  if (s.status === "active") return { key: "active", tone: "success" };
  return { key: s.status, tone: s.status === "revoked" ? "danger" : "neutral" };
}

/** Designer plan and Customer Plus as two independent cards, plus history. Grants are not payments. */
export default async function MySubscriptionPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/subscription");
  if (!customer) return <AccountUnavailable retryHref="/account/subscription" />;
  const [overview, history] = await Promise.all([getSubscriptionOverview(locale), getSubscriptionHistory(locale)]);
  if (!overview.ok || !history.ok) return <AccountUnavailable retryHref="/account/subscription" />;
  const sp = await searchParams;
  const t = await getTranslations("Designers");
  const ts = await getTranslations("Account.titles");
  const period = (p: string) => (p === "monthly" ? t("plans.monthly") : t("plans.yearly"));

  const card = (audience: "designer" | "customer") => {
    const state = overview.data[audience];
    const s = state.subscription;
    const status = statusOf(state);
    const pending = state.pending_request;
    const plansHref = `/subscriptions?for=${audience === "designer" ? "designers" : "customers"}`;
    const lastRejected = history.data.requests.find((r) => r.audience === audience && r.status !== "cancelled");
    return (
      <AccountSection key={audience} id={audience} title={audience === "designer" ? t("subscription.designer") : t("subscription.customer")}>
        <div className="space-y-4" data-testid={`subscription-${audience}`}>
          <StatusBadge tone={status.tone}>{t(`subscription.status.${status.key}` as never)}</StatusBadge>
          {s ? (
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("subscription.plan")}</dt>
                <dd className="font-semibold">{s.plan.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("subscription.period")}</dt>
                <dd className="font-semibold">
                  {period(s.billing_period)}
                  {s.terms.list_amount && s.terms.currency_code ? ` · ${formatMoney(s.terms.list_amount, { code: s.terms.currency_code, decimal_places: s.terms.currency_decimal_places ?? 2 }, locale)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("subscription.started")}</dt>
                <dd className="font-semibold">{formatDate(s.starts_at, locale)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("subscription.ends")}</dt>
                <dd className="font-semibold">{formatDate(s.ends_at, locale)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t("subscription.none")}</p>
          )}
          {s?.grants_access ? <p className="text-sm text-muted-foreground">{t("subscription.source")}</p> : null}
          {s?.grants_access && s.cancel_at_period_end ? <p className="text-sm">{t("subscription.accessUntil", { date: formatDate(s.ends_at, locale) })}</p> : null}

          {pending ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4">
              <p className="text-sm">
                <StatusBadge tone="warning">{t("subscription.status.pending")}</StatusBadge>{" "}
                {t("subscription.pendingRequest", { date: formatDate(pending.created_at, locale), plan: pending.plan.name ?? "", period: period(pending.billing_period) })}
              </p>
              <ActionButton action={withdrawSubscriptionRequestAction} fields={{ request_id: pending.id }} testId={`withdraw-${audience}`}>
                {t("subscription.withdraw")}
              </ActionButton>
            </div>
          ) : lastRejected?.status === "rejected" && !state.entitled ? (
            <p className="text-sm">
              {t("subscription.lastRejected")} {lastRejected.decision_note ? t("subscription.teamNote", { note: lastRejected.decision_note }) : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {!pending ? (
              <Link href={plansHref} className={buttonClass({ variant: s?.grants_access ? "outline" : "brand" })}>
                {s?.grants_access ? t("subscription.renew") : t("subscription.seePlans")}
              </Link>
            ) : null}
            {s?.grants_access && !s.cancel_at_period_end ? (
              <ConfirmAction
                action={cancelSubscriptionAction}
                fields={{ subscription_id: s.id }}
                trigger={t("subscription.cancel")}
                question={t("subscription.cancelConfirm", { date: formatDate(s.ends_at, locale) })}
                confirmLabel={t("subscription.confirm")}
                keepLabel={t("subscription.keep")}
                testId={`cancel-${audience}`}
              />
            ) : null}
          </div>
        </div>
      </AccountSection>
    );
  };

  const rows = [
    ...history.data.subscriptions.map((s) => ({ key: `s${s.id}`, at: s.starts_at, text: t("subscription.subscriptionRow", { plan: s.plan.name ?? "", from: formatDate(s.starts_at, locale), to: formatDate(s.ends_at, locale) }), status: s.status })),
    ...history.data.requests.map((r) => ({ key: `r${r.id}`, at: r.created_at ?? "", text: t("subscription.requestRow", { plan: r.plan.name ?? "", period: period(r.billing_period) }), status: r.status === "cancelled" ? "withdrawn" : r.status })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="space-y-6">
      <AccountHeading title={ts("subscription")} intro={t("subscription.intro")} />
      {sp.requested ? <Notice>{t("subscription.requested")}</Notice> : null}
      <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm" role="note">
        <Info className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        {t("subscription.honest")}
      </p>
      {card("designer")}
      {card("customer")}
      <AccountSection title={t("subscription.history")}>
        {rows.length ? (
          <ul className="divide-y divide-border text-sm" data-testid="subscription-history">
            {rows.map((row) => (
              <li key={row.key} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>{row.text}</span>
                <StatusBadge tone="neutral">{t(`subscription.status.${row.status}` as never)}</StatusBadge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("subscription.historyEmpty")}</p>
        )}
      </AccountSection>
    </div>
  );
}
