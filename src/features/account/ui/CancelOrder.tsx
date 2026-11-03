"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { cancelOrderAction } from "../actions";
import { IDLE } from "../form-state";
import { FormAlert, SubmitButton } from "./fields";

/**
 * Cancel an unpaid order: an in-page confirmation (no browser dialog), then
 * a Server Action. The API re-checks everything (a payment that is being
 * processed, or already captured, refuses the cancellation with a message).
 */
export function CancelOrder({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const t = useTranslations("Account.orders.cancel");
  const [state, action] = useActionState(cancelOrderAction, IDLE);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <FormAlert state={state} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-danger hover:bg-danger-soft"
          data-testid="cancel-order"
        >
          {t("button")}
        </button>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl bg-danger-soft p-4" role="group" aria-label={t("confirmLabel", { number: orderNumber })}>
      <input type="hidden" name="order_id" value={orderId} />
      <FormAlert state={state} />
      <p className="text-sm font-semibold">{t("confirm")}</p>
      <p className="text-sm text-muted-foreground">{t("confirmBody")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold hover:bg-surface">
          {t("keep")}
        </button>
        <SubmitButton variant="primary" className="h-11! px-5! text-sm! sm:w-auto!" pendingLabel={t("working")}>
          {t("confirmButton")}
        </SubmitButton>
      </div>
    </form>
  );
}
