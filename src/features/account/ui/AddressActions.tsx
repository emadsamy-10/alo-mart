"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { deleteAddressAction, setDefaultAddressAction } from "../actions";
import { IDLE } from "../form-state";
import { FormAlert, SubmitButton } from "./fields";

const small = "h-10! px-4! text-sm! sm:w-auto!";

export function SetDefaultAddress({ id, label }: { id: number; label: string }) {
  const t = useTranslations("Account.addresses");
  const [state, action] = useActionState(setDefaultAddressAction, IDLE);
  return (
    <form action={action}>
      <input type="hidden" name="address_id" value={id} />
      <FormAlert state={state} className="mb-2" />
      <SubmitButton variant="outline" className={small}>
        <span aria-hidden>{t("makeDefaultShort")}</span>
        <span className="sr-only">{t("makeDefaultNamed", { label })}</span>
      </SubmitButton>
    </form>
  );
}

/** Deleting asks for an in-page confirmation (no browser dialog), then posts. */
export function DeleteAddress({ id, label }: { id: number; label: string }) {
  const t = useTranslations("Account.addresses");
  const [state, action] = useActionState(deleteAddressAction, IDLE);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-danger hover:bg-danger-soft">
        <span aria-hidden>{t("delete")}</span>
        <span className="sr-only">{t("deleteNamed", { label })}</span>
      </button>
    );
  }
  return (
    <form action={action} className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-danger-soft px-3 py-2" role="group" aria-label={t("deleteNamed", { label })}>
      <input type="hidden" name="address_id" value={id} />
      <FormAlert state={state} className="w-full" />
      <p className="me-auto text-sm font-semibold">{t("confirmDelete")}</p>
      <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold hover:bg-surface">
        {t("keep")}
      </button>
      <SubmitButton variant="primary" className={small}>
        {t("confirmDeleteButton")}
      </SubmitButton>
    </form>
  );
}
