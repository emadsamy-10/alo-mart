"use client";

import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { resendVerificationAction, verifyEmailAction } from "../actions";
import { IDLE } from "../form-state";
import { FormAlert, SubmitButton } from "./fields";

type Outcome = Awaited<ReturnType<typeof verifyEmailAction>>;

/**
 * Confirms the emailed link. The token is submitted by script after the page
 * loads (a POST, never a GET side effect), so link scanners and prefetching
 * cannot consume it. One attempt per page view.
 */
export function VerifyEmail({ token }: { token: string }) {
  const t = useTranslations("Auth.verify");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmailAction(token).then(setOutcome, () => setOutcome({ status: "error", signedIn: false }));
  }, [token]);

  if (!outcome) {
    return (
      <p role="status" className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
        {t("checking")}
      </p>
    );
  }

  const ok = outcome.status === "verified" || outcome.status === "already";
  const continueHref = outcome.signedIn ? "/account" : "/login";

  return (
    <div role={ok ? "status" : "alert"} className="space-y-5 text-center" data-testid={`verify-${outcome.status}`}>
      <span className={`mx-auto grid size-14 place-items-center rounded-full ${ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`} aria-hidden>
        {ok ? <CheckCircle2 className="size-7" /> : <MailWarning className="size-7" />}
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t(`${outcome.status}.title`)}</h2>
        <p className="text-muted-foreground">{t(`${outcome.status}.body`)}</p>
      </div>
      <div className="flex flex-col items-center gap-3">
        {ok ? (
          <>
            <Link href={continueHref} className={buttonClass({ variant: "brand", size: "lg" })}>
              {outcome.signedIn ? t("toAccount") : t("toLogin")}
            </Link>
            {/* Ordering needs a verified email: the cart and addresses are kept, so checkout continues. */}
            {outcome.signedIn ? (
              <Link href="/checkout" className={buttonClass({ variant: "outline", size: "lg" })} data-testid="verify-to-checkout">
                {t("toCheckout")}
              </Link>
            ) : null}
          </>
        ) : outcome.signedIn ? (
          <ResendVerificationForm />
        ) : (
          <Link href="/login?next=%2Faccount%2Fsecurity" className={buttonClass({ variant: "brand", size: "lg" })}>
            {t("signInToResend")}
          </Link>
        )}
      </div>
    </div>
  );
}

export function ResendVerificationForm({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("Auth.verify");
  const [state, action] = useActionState(resendVerificationAction, IDLE);
  return (
    <form action={action} className={compact ? "space-y-3" : "w-full space-y-3"} data-testid="resend-verification">
      <FormAlert state={state} />
      <SubmitButton variant={compact ? "outline" : "brand"} pendingLabel={t("resending")}>
        {t("resend")}
      </SubmitButton>
    </form>
  );
}
