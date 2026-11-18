"use client";

import { Check, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import { IDLE, type FormState } from "@/features/account/form-state";
import { FormAlert, SubmitButton } from "@/features/account/ui/fields";
import { requestSubscriptionAction } from "../actions";
import type { Plan } from "../schemas";

/** What blocks a request for this viewer (computed on the server from real account state). */
export type RequestGate =
  | { kind: "guest" }
  | { kind: "unverified" }
  | { kind: "apply_first" }
  | { kind: "pending" }
  | { kind: "ready"; renewal: boolean; activeUntil: string | null };

const ENTITLEMENT_ORDER = ["max_published_designs", "max_images_per_design", "max_videos_per_design", "follow_designers", "save_designs", "members_only_designs", "max_saved_designs"] as const;

/**
 * One plan: list price per period (only periods the admin configured), the
 * entitlements the server enforces, and a REQUEST form (no payment). The
 * gate explains, with a link, what the viewer has to do first.
 */
export function PlanCard({ plan, gate, back }: { plan: Plan; gate: RequestGate; back: string }) {
  const t = useTranslations("Designers");
  const locale = useLocale();
  const id = useId();
  const [period, setPeriod] = useState(plan.prices[0]?.billing_period ?? "monthly");
  const [state, action] = useActionState<FormState, FormData>(requestSubscriptionAction, IDLE);
  const unverified = gate.kind === "unverified" || state.code === "email_unverified";

  const features: string[] = [];
  if (plan.audience === "designer") features.push(t("entitlements.profile"), t("entitlements.review"));
  for (const key of ENTITLEMENT_ORDER) {
    const value = plan.entitlements[key];
    if (value === undefined || value === false) continue;
    features.push(typeof value === "number" ? t(`entitlements.${key}`, { value }) : t(`entitlements.${key}`));
  }

  return (
    <article className="flex h-full flex-col rounded-panel border border-border bg-surface p-6 shadow-card" data-testid="plan-card" aria-labelledby={`${id}-name`}>
      <h3 id={`${id}-name`} className="text-xl font-bold">
        {plan.name}
      </h3>
      {plan.description ? <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p> : null}

      <dl className="mt-5 space-y-2">
        {plan.prices.map((p) => (
          <div key={p.billing_period} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-muted-foreground">
              {p.billing_period === "monthly" ? t("plans.monthly") : t("plans.yearly")} · {t("plans.listPrice")}
            </dt>
            <dd className="font-bold" dir="ltr">
              {formatMoney(p.list_amount, p.currency, locale)} <span className="text-sm font-normal text-muted-foreground">{p.billing_period === "monthly" ? t("plans.perMonth") : t("plans.perYear")}</span>
            </dd>
          </div>
        ))}
      </dl>

      <h4 className="mt-6 text-sm font-semibold">{t("plans.included")}</h4>
      <ul className="mt-2 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            {f}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-6">
        {gate.kind === "guest" ? (
          <Link href={`/login?next=${encodeURIComponent(back)}`} className={buttonClass({ variant: "brand", size: "lg" }, "w-full")}>
            {t("plans.signIn")}
          </Link>
        ) : unverified ? (
          <GateNotice text={t("plans.verifyFirst")} href="/account" cta={t("plans.verifyCta")} />
        ) : gate.kind === "apply_first" ? (
          <GateNotice text={t("plans.applyFirst")} href="/account/designer" cta={t("plans.applyCta")} />
        ) : gate.kind === "pending" ? (
          <GateNotice text={t("plans.pending")} href="/account/subscription" cta={t("plans.manage")} />
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <FormAlert state={state} />
            <input type="hidden" name="plan_id" value={plan.id} />
            <input type="hidden" name="back" value={back} />
            {gate.activeUntil ? (
              <p className="text-sm text-muted-foreground">
                {t("plans.activeUntil", { date: formatDate(gate.activeUntil, locale) })} · {t("plans.renewHint")}
              </p>
            ) : null}
            {plan.prices.length > 1 ? (
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{t("plans.period")}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {plan.prices.map((p) => (
                    <label key={p.billing_period} className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-border px-3 text-sm font-semibold has-checked:border-brand has-checked:bg-surface-muted">
                      <input type="radio" name="billing_period" value={p.billing_period} checked={period === p.billing_period} onChange={() => setPeriod(p.billing_period)} className="accent-brand" />
                      {p.billing_period === "monthly" ? t("plans.monthly") : t("plans.yearly")}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <input type="hidden" name="billing_period" value={period} />
            )}
            <div className="space-y-1.5">
              <label htmlFor={`${id}-note`} className="text-sm font-semibold">
                {t("plans.note")}
              </label>
              <textarea
                id={`${id}-note`}
                name="note"
                rows={2}
                maxLength={500}
                defaultValue={state.values?.note ?? ""}
                placeholder={t("plans.notePlaceholder")}
                className="block w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base shadow-sm hover:border-border-strong focus:border-brand focus:outline-none"
              />
            </div>
            <SubmitButton pendingLabel={t("plans.requesting")} className="w-full sm:w-full">
              {t("plans.request")}
            </SubmitButton>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t("plans.onlinePayment")}
            </p>
          </form>
        )}
      </div>
    </article>
  );
}

function GateNotice({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface-muted p-4 text-sm" role="note">
      <p>{text}</p>
      <Link href={href} className={buttonClass({ variant: "outline" }, "w-full")}>
        {cta}
      </Link>
    </div>
  );
}
