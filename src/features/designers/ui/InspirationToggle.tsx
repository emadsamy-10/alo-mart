"use client";

import { Bookmark, BookmarkCheck, Loader2, UserCheck, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { IDLE, type FormState } from "@/features/account/form-state";
import { toggleInspirationAction } from "../actions";

interface Props {
  kind: "designer" | "design";
  slug: string;
  name: string;
  active: boolean;
  signedIn: boolean;
  /** Locale-less path to come back to after signing in. */
  back: string;
}

function Submit({ active, kind, name }: { active: boolean; kind: Props["kind"]; name: string }) {
  const t = useTranslations("Designers.follow");
  const { pending } = useFormStatus();
  const Icon = pending ? Loader2 : kind === "designer" ? (active ? UserCheck : UserPlus) : active ? BookmarkCheck : Bookmark;
  const label = kind === "designer" ? (active ? t("following") : t("follow")) : active ? t("saved") : t("save");
  const aria = kind === "designer" ? (active ? t("unfollow", { name }) : t("followName", { name })) : active ? t("unsaveName", { name }) : t("saveName", { name });
  return (
    <button type="submit" disabled={pending} aria-pressed={active} aria-label={aria} className={buttonClass({ variant: active ? "primary" : "outline" })} data-testid={`${kind}-toggle`}>
      <Icon className={pending ? "size-4.5 animate-spin" : "size-4.5"} aria-hidden />
      {label}
    </button>
  );
}

/**
 * Follow a designer / save a design (Customer Plus). The API decides: without
 * an active Customer Plus subscription it answers 403 and we explain why with
 * a link to the plans, instead of hiding the control.
 */
export function InspirationToggle({ kind, slug, name, active, signedIn, back }: Props) {
  const t = useTranslations("Designers.follow");
  const [state, action] = useActionState<FormState, FormData>(toggleInspirationAction, IDLE);
  const current = state.status === "success" ? state.values?.on === "1" : active;
  const needsPlan = state.status === "error" && state.code === "customer_subscription_required";

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(back)}`} className={buttonClass({ variant: "outline" })}>
        {kind === "designer" ? <UserPlus className="size-4.5" aria-hidden /> : <Bookmark className="size-4.5" aria-hidden />}
        {t("signIn")}
      </Link>
    );
  }

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="on" value={current ? "0" : "1"} />
        <input type="hidden" name="back" value={back} />
        <Submit active={current} kind={kind} name={name} />
      </form>
      {state.status === "error" ? (
        <p role="alert" className="max-w-xs text-sm text-muted-foreground">
          {needsPlan ? t("needPlus") : state.message}{" "}
          {needsPlan ? (
            <Link href="/subscriptions?for=customers" className="font-semibold text-brand-text hover:underline">
              {t("seePlans")}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
