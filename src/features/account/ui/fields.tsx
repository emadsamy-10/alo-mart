"use client";

import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { FormState } from "../form-state";

/*
 * Accessible form building blocks for the account area: every control has a
 * visible <label>, errors are tied to the control (aria-invalid +
 * aria-describedby) and announced, touch targets are ≥ 44px, and logical
 * properties keep RTL correct.
 */

const control =
  "block h-12 w-full rounded-2xl border bg-surface px-4 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 " +
  "hover:border-border-strong focus:border-brand focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: ReactNode;
}

function FieldShell({ id, label, error, hint, optional, children }: FieldShellProps) {
  const t = useTranslations("Auth");
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold text-foreground">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted-foreground">{t("optional")}</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
};

export function TextField({ label, error, hint, optional, className, ...input }: TextFieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} optional={optional}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(control, error ? "border-danger" : "border-border", className)}
        {...input}
      />
    </FieldShell>
  );
}

/** Password input with a show/hide toggle (a real button, labelled, state announced). */
export function PasswordField({ label, error, hint, ...input }: Omit<TextFieldProps, "type">) {
  const id = useId();
  const t = useTranslations("Auth");
  const [visible, setVisible] = useState(false);
  const describedBy = [error ? `${id}-error` : null, hint && !error ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="none"
          className={cn(control, "pe-14", error ? "border-danger" : "border-border")}
          {...input}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 end-1 my-auto grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </FieldShell>
  );
}

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  name: string;
  label: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
};

export function SelectField({ label, error, optional, children, className, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} optional={optional}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(control, "appearance-auto pe-3", error ? "border-danger" : "border-border", className)}
        {...select}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ name, label, defaultChecked }: { name: string; label: ReactNode; defaultChecked?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="size-5 shrink-0 rounded accent-brand" />
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
    </div>
  );
}

/** Submit button that disables itself and shows progress while the action runs (no double submits). */
export function SubmitButton({ children, pendingLabel, variant = "brand", className }: { children: ReactNode; pendingLabel?: string; variant?: ButtonVariant; className?: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Auth");
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={buttonClass({ variant, size: "lg" }, cn("w-full sm:w-auto", className))}>
      {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
      {pending ? (pendingLabel ?? t("working")) : children}
    </button>
  );
}

/** The form-level result: an alert for errors, a polite status for success. */
export function FormAlert({ state, className }: { state: FormState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;
  const error = state.status === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        error ? "border-danger/25 bg-danger-soft text-foreground" : "border-success/25 bg-success-soft text-foreground",
        className,
      )}
    >
      {error ? <AlertCircle className="mt-0.5 size-5 shrink-0 text-danger" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />}
      <span>{state.message}</span>
    </div>
  );
}

/** A static notice (not tied to a form), e.g. "Your password was reset — sign in". */
export function Notice({ tone = "success", children }: { tone?: "success" | "info" | "warning"; children: ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm leading-relaxed text-foreground",
        tone === "success" && "border-success/25 bg-success-soft",
        tone === "info" && "border-border bg-surface-muted",
        tone === "warning" && "border-warning/30 bg-warning-soft",
      )}
    >
      {tone === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden /> : <AlertCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}
