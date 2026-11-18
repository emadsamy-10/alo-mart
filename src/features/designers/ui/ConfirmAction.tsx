"use client";

import { useActionState, useState, type ReactNode } from "react";
import { IDLE, type FormState } from "@/features/account/form-state";
import { FormAlert, SubmitButton } from "@/features/account/ui/fields";

/**
 * An in-page two-step confirmation (no browser dialog) in front of a Server
 * Action, the same pattern as order cancellation.
 */
export function ConfirmAction({
  action,
  fields,
  trigger,
  question,
  confirmLabel,
  keepLabel,
  testId,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string | number>;
  trigger: ReactNode;
  question: string;
  confirmLabel: string;
  keepLabel: string;
  testId?: string;
}) {
  const [state, run] = useActionState(action, IDLE);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-2">
        <FormAlert state={state} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-5 text-sm font-semibold text-danger hover:bg-danger-soft"
          data-testid={testId}
        >
          {trigger}
        </button>
      </div>
    );
  }
  return (
    <form action={run} className="space-y-3 rounded-2xl bg-danger-soft p-4" role="group">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormAlert state={state} />
      <p className="text-sm font-semibold">{question}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setConfirming(false)} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold hover:bg-surface">
          {keepLabel}
        </button>
        <SubmitButton variant="primary" className="h-11! px-5! text-sm! sm:w-auto!">
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

/** A single-button Server Action form with its own result message. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "outline",
  testId,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: Record<string, string | number>;
  children: ReactNode;
  variant?: "brand" | "outline" | "primary";
  testId?: string;
}) {
  const [state, run] = useActionState(action, IDLE);
  return (
    <form action={run} className="space-y-2" data-testid={testId}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <FormAlert state={state} />
      <SubmitButton variant={variant} className="sm:w-auto">
        {children}
      </SubmitButton>
    </form>
  );
}
