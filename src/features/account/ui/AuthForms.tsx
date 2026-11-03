"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "../actions";
import { IDLE } from "../form-state";
import { CheckboxField, FormAlert, PasswordField, SubmitButton, TextField } from "./fields";

const linkClass = "font-semibold text-brand-text underline-offset-4 hover:underline";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(loginAction, IDLE);
  const withNext = (path: string) => (next ? `${path}?next=${encodeURIComponent(next)}` : path);

  return (
    <form action={action} noValidate className="space-y-5" data-testid="login-form">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <PasswordField name="password" label={t("password")} autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CheckboxField name="remember" label={t("login.remember")} />
        <Link href="/forgot-password" className={`${linkClass} inline-flex min-h-11 items-center text-sm`}>
          {t("login.forgot")}
        </Link>
      </div>
      <SubmitButton pendingLabel={t("login.pending")} className="sm:w-full">
        {t("login.submit")}
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link href={withNext("/register")} className={linkClass}>
          {t("login.create")}
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(registerAction, IDLE);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5" data-testid="register-form">
      <FormAlert state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <TextField name="name" label={t("name")} autoComplete="name" required maxLength={255} defaultValue={state.values?.name} error={e.name} />
      <TextField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={255}
        defaultValue={state.values?.email}
        error={e.email}
        hint={t("register.emailHint")}
      />
      <TextField
        name="phone"
        type="tel"
        label={t("phone")}
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        required
        maxLength={30}
        defaultValue={state.values?.phone}
        error={e.phone}
      />
      <PasswordField name="password" label={t("password")} autoComplete="new-password" required minLength={8} error={e.password} hint={t("passwordRule")} />
      <PasswordField name="password_confirmation" label={t("confirmPassword")} autoComplete="new-password" required minLength={8} error={e.password_confirmation} />
      <SubmitButton pendingLabel={t("register.pending")} className="sm:w-full">
        {t("register.submit")}
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        {t("register.haveAccount")}{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className={linkClass}>
          {t("register.signIn")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(forgotPasswordAction, IDLE);

  return (
    <form action={action} noValidate className="space-y-5" data-testid="forgot-form">
      <FormAlert state={state} />
      <TextField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel={t("forgot.pending")} className="sm:w-full">
        {t("forgot.submit")}
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className={linkClass}>
          {t("forgot.back")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("Auth");
  const [state, action] = useActionState(resetPasswordAction, IDLE);
  const e = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate className="space-y-5" data-testid="reset-form">
      <FormAlert state={state} />
      {state.code === "reset_invalid" ? (
        <p className="text-sm">
          <Link href="/forgot-password" className={linkClass}>
            {t("reset.requestNew")}
          </Link>
        </p>
      ) : null}
      <input type="hidden" name="token" value={token} />
      {/* The account's email, for password managers; fixed by the link. */}
      <TextField name="email" type="email" label={t("email")} autoComplete="username" readOnly defaultValue={email} error={e.email} />
      <PasswordField name="password" label={t("newPassword")} autoComplete="new-password" required minLength={8} error={e.password} hint={t("passwordRule")} />
      <PasswordField name="password_confirmation" label={t("confirmPassword")} autoComplete="new-password" required minLength={8} error={e.password_confirmation} />
      <SubmitButton pendingLabel={t("reset.pending")} className="sm:w-full">
        {t("reset.submit")}
      </SubmitButton>
    </form>
  );
}
