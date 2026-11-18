"use client";

import { MailWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { ResendVerificationForm } from "@/features/account/ui/VerifyEmail";

/**
 * The backend refuses a NEW order until the customer's email is verified
 * (403 `email_unverified`). The cart and the chosen address stay as they
 * are; after verifying (the emailed link), checkout continues where it was.
 */
export function VerifyEmailNotice() {
  const t = useTranslations("Checkout.verifyEmail");
  return (
    <section role="status" className="mb-6 flex flex-col gap-4 rounded-panel border border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-start" data-testid="checkout-verify-email">
      <MailWarning className="size-6 shrink-0 text-foreground" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="font-bold">{t("title")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      </div>
      {/* Sized by the button (its label is wider than 15rem in some languages), capped so feedback text wraps. */}
      <div className="sm:max-w-72 sm:shrink-0">
        <ResendVerificationForm compact />
      </div>
    </section>
  );
}
