"use client";

import { Monitor } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { formatDateTime } from "@/lib/i18n/format";
import {
  changeEmailAction,
  changePasswordAction,
  changePhoneAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  updateProfileAction,
} from "../actions";
import { IDLE } from "../form-state";
import type { AccountSession, Customer } from "../schemas";
import { FormAlert, PasswordField, SelectField, SubmitButton, TextField } from "./fields";

export function ProfileForm({ customer }: { customer: Customer }) {
  const t = useTranslations("Account.profile");
  const ta = useTranslations("Auth");
  const [state, action] = useActionState(updateProfileAction, IDLE);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} noValidate className="space-y-5" data-testid="profile-form">
      <FormAlert state={state} />
      <TextField name="name" label={ta("name")} autoComplete="name" required maxLength={255} defaultValue={v?.name ?? customer.name} error={e.name} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SelectField name="gender" label={t("gender")} optional defaultValue={v?.gender ?? customer.gender ?? ""} error={e.gender}>
          <option value="">{t("genderUnset")}</option>
          <option value="female">{t("female")}</option>
          <option value="male">{t("male")}</option>
        </SelectField>
        <TextField
          name="date_of_birth"
          type="date"
          label={t("dateOfBirth")}
          optional
          autoComplete="bday"
          min="1900-01-01"
          max={today}
          defaultValue={v?.date_of_birth ?? customer.date_of_birth?.slice(0, 10) ?? ""}
          error={e.date_of_birth}
        />
      </div>
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

export function ChangePasswordForm() {
  const t = useTranslations("Account.security");
  const ta = useTranslations("Auth");
  const [state, action] = useActionState(changePasswordAction, IDLE);
  const e = state.fieldErrors ?? {};
  // A successful change resets the fields (new key = fresh, empty inputs).
  return (
    <form key={state.status === "success" ? state.message : "form"} action={action} noValidate className="space-y-5" data-testid="password-form">
      <FormAlert state={state} />
      <PasswordField name="current_password" label={t("currentPassword")} autoComplete="current-password" required error={e.current_password} />
      <PasswordField name="password" label={ta("newPassword")} autoComplete="new-password" required minLength={8} error={e.password} hint={ta("passwordRule")} />
      <PasswordField name="password_confirmation" label={ta("confirmPassword")} autoComplete="new-password" required minLength={8} error={e.password_confirmation} />
      <p className="text-xs leading-relaxed text-muted-foreground">{t("passwordSignsOut")}</p>
      <SubmitButton pendingLabel={ta("working")}>{t("changePassword")}</SubmitButton>
    </form>
  );
}

export function ChangeEmailForm({ email }: { email: string }) {
  const t = useTranslations("Account.security");
  const ta = useTranslations("Auth");
  const [state, action] = useActionState(changeEmailAction, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-5" data-testid="email-form">
      <FormAlert state={state} />
      <TextField
        name="email"
        type="email"
        label={t("newEmail")}
        autoComplete="email"
        inputMode="email"
        required
        maxLength={255}
        defaultValue={state.status === "error" ? state.values?.email : ""}
        placeholder={email}
        error={e.email}
        hint={t("emailHint")}
      />
      <PasswordField name="current_password" label={t("currentPassword")} autoComplete="current-password" required error={e.current_password} />
      <SubmitButton pendingLabel={ta("working")}>{t("changeEmail")}</SubmitButton>
    </form>
  );
}

export function ChangePhoneForm({ phone }: { phone: string | null }) {
  const t = useTranslations("Account.security");
  const ta = useTranslations("Auth");
  const [state, action] = useActionState(changePhoneAction, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate className="space-y-5" data-testid="phone-form">
      <FormAlert state={state} />
      <TextField
        name="phone"
        type="tel"
        label={t("newPhone")}
        autoComplete="tel"
        inputMode="tel"
        dir="ltr"
        required
        maxLength={30}
        defaultValue={state.values?.phone ?? phone ?? ""}
        error={e.phone}
      />
      <PasswordField name="current_password" label={t("currentPassword")} autoComplete="current-password" required error={e.current_password} />
      <SubmitButton pendingLabel={ta("working")}>{t("changePhone")}</SubmitButton>
    </form>
  );
}

function RevokeButton({ id, name }: { id: number; name: string }) {
  const t = useTranslations("Account.security");
  const [state, action] = useActionState(revokeSessionAction, IDLE);
  return (
    <form action={action} className="shrink-0">
      <input type="hidden" name="session_id" value={id} />
      {state.status === "error" ? (
        <p role="alert" className="mb-1 text-xs text-danger">
          {state.message}
        </p>
      ) : null}
      <SubmitButton variant="outline" className="h-10! px-4! text-sm!">
        <span aria-hidden>{t("signOutSession")}</span>
        <span className="sr-only">{t("signOutSessionNamed", { name })}</span>
      </SubmitButton>
    </form>
  );
}

export function SessionsList({ sessions }: { sessions: AccountSession[] }) {
  const t = useTranslations("Account.security");
  const locale = useLocale();
  const [state, action] = useActionState(revokeOtherSessionsAction, IDLE);
  const others = sessions.filter((s) => !s.is_current).length;

  return (
    <div className="space-y-4">
      <FormAlert state={state} />
      <ul className="divide-y divide-border rounded-2xl border border-border" data-testid="sessions">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <Monitor className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {s.name === "api" ? t("unnamedDevice") : s.name}
                {s.is_current ? <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-foreground">{t("thisDevice")}</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("signedInAt", { date: s.created_at ? formatDateTime(s.created_at, locale) : "—" })}
                {s.last_used_at ? ` · ${t("lastActive", { date: formatDateTime(s.last_used_at, locale) })}` : null}
              </p>
            </div>
            {s.is_current ? null : <RevokeButton id={s.id} name={s.name === "api" ? t("unnamedDevice") : s.name} />}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <form action={action}>
          <SubmitButton variant="outline">{t("signOutOthers", { count: others })}</SubmitButton>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noOtherSessions")}</p>
      )}
    </div>
  );
}
