"use client";

import { CheckCircle2, Clock, CreditCard, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button";
import { IDLE } from "@/features/account/form-state";
import { FormAlert, SubmitButton } from "@/features/account/ui/fields";
import { Link } from "@/lib/i18n/navigation";
import { payOrderAction } from "../actions";
import type { PaymentState } from "../model";
import type { PaymentMethod } from "../schemas";

interface PaymentPanelProps {
  orderId: string;
  state: PaymentState;
  methods: PaymentMethod[];
  /** Fresh key for a (re)try started from this page. */
  idempotencyKey: string;
}

/**
 * The order's payment, exactly as the backend reports it. A browser return
 * from the provider never marks an order paid — only the provider's webhook
 * does — so "pending" states offer a status refresh, not a fake success.
 */
export function PaymentPanel({ orderId, state, methods, idempotencyKey }: PaymentPanelProps) {
  const t = useTranslations("Checkout.payment");
  const [result, action] = useActionState(payOrderAction, IDLE);
  const refresh = (
    <Link href={`/account/orders/${orderId}`} className={buttonClass({ variant: "outline" })}>
      <RefreshCw className="size-4" aria-hidden />
      {t("refresh")}
    </Link>
  );

  if (state.kind === "paid") {
    return (
      <Status tone="success" icon={<CheckCircle2 className="size-5" />} title={t("paidTitle")} body={t("paidBody")} testId="payment-paid" />
    );
  }

  if (state.kind === "action") {
    return (
      <div className="space-y-4" data-testid="payment-action">
        <Status tone="info" icon={<CreditCard className="size-5" />} title={t("actionTitle")} body={t("actionBody", { method: state.method ?? "" })} />
        <div className="flex flex-wrap gap-3">
          {/* The provider's own page (validated https URL from the API). */}
          <a href={state.url} rel="noopener noreferrer" referrerPolicy="no-referrer" className={buttonClass({ variant: "brand" })} data-testid="payment-continue">
            {t("continue")}
            <ExternalLink className="size-4" aria-hidden />
          </a>
          {refresh}
        </div>
      </div>
    );
  }

  if (state.kind === "processing") {
    return (
      <div className="space-y-4" data-testid="payment-processing">
        <Status tone="info" icon={<Clock className="size-5" />} title={t("processingTitle")} body={t("processingBody")} />
        {refresh}
      </div>
    );
  }

  // unpaid or failed: choose a method and (re)start the payment
  return (
    <div className="space-y-4" data-testid={state.kind === "failed" ? "payment-failed" : "payment-unpaid"}>
      {state.kind === "failed" ? (
        <Status tone="error" icon={<XCircle className="size-5" />} title={t("failedTitle")} body={t("failedBody")} />
      ) : (
        <Status tone="info" icon={<CreditCard className="size-5" />} title={t("unpaidTitle")} body={t("unpaidBody")} />
      )}
      {methods.length === 0 ? (
        <p className="text-sm text-danger" role="alert">
          {t("noMethods")}
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <FormAlert state={result} />
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="idempotency_key" value={idempotencyKey} />
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-semibold">{t("method")}</legend>
            {methods.map((m, i) => (
              <label key={m.code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border border-border px-4 has-[:checked]:border-brand">
                <input type="radio" name="payment_method" value={m.code} defaultChecked={i === 0} className="size-4 accent-brand" />
                <span className="text-sm font-semibold">{m.name}</span>
              </label>
            ))}
          </fieldset>
          <SubmitButton pendingLabel={t("starting")}>{state.kind === "failed" ? t("retry") : t("payNow")}</SubmitButton>
        </form>
      )}
    </div>
  );
}

function Status({ tone, icon, title, body, testId }: { tone: "success" | "info" | "error"; icon: React.ReactNode; title: string; body: string; testId?: string }) {
  const styles = { success: "border-success/25 bg-success-soft", info: "border-border bg-surface-muted", error: "border-danger/25 bg-danger-soft" }[tone];
  const iconColor = { success: "text-success", info: "text-foreground", error: "text-danger" }[tone];
  return (
    <div role="status" className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${styles}`} data-testid={testId}>
      <span className={`mt-0.5 shrink-0 ${iconColor}`} aria-hidden>
        {icon}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}
