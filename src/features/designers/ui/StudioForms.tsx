"use client";

import { ImageUp, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { IDLE, type FormState } from "@/features/account/form-state";
import { FormAlert, SubmitButton, TextField } from "@/features/account/ui/fields";
import { cn } from "@/lib/utils/cn";
import { applyDesignerAction, removeDesignerImageAction, resubmitDesignerAction, updateDesignerProfileAction, uploadDesignerImageAction } from "../actions";
import type { OwnProfile } from "../schemas";

const textarea =
  "block w-full rounded-2xl border bg-surface px-4 py-3 text-base shadow-sm hover:border-border-strong focus:border-brand focus:outline-none";

/** A labelled textarea with the same error/hint wiring as TextField. */
export function TextAreaField({ name, label, defaultValue, error, hint, rows = 4, maxLength, optional }: { name: string; label: string; defaultValue?: string; error?: string; hint?: string; rows?: number; maxLength?: number; optional?: boolean }) {
  const id = useId();
  const tAuth = useTranslations("Auth");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-semibold">
        <span>{label}</span>
        {optional ? <span className="text-xs font-normal text-muted-foreground">{tAuth("optional")}</span> : null}
      </label>
      <textarea id={id} name={name} rows={rows} maxLength={maxLength} defaultValue={defaultValue} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn(textarea, error ? "border-danger" : "border-border")} />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Apply (no profile yet) or edit the designer profile. Same fields; the API decides what is allowed. */
export function DesignerProfileForm({ profile }: { profile: OwnProfile | null }) {
  const t = useTranslations("Designers.studio");
  const [state, action] = useActionState<FormState, FormData>(profile ? updateDesignerProfileAction : applyDesignerAction, IDLE);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const value = (key: string, fallback: string) => v?.[key] ?? fallback;

  return (
    <form action={action} noValidate className="space-y-5" data-testid={profile ? "designer-profile-form" : "designer-apply-form"}>
      <FormAlert state={state} />
      <TextField name="display_name" label={t("fields.display_name")} required minLength={2} maxLength={80} defaultValue={value("display_name", profile?.display_name ?? "")} error={e.display_name} />
      <TextField name="headline" label={t("fields.headline")} optional maxLength={140} defaultValue={value("headline", profile?.headline ?? "")} error={e.headline} />
      <TextAreaField name="bio" label={t("fields.bio")} optional maxLength={2000} defaultValue={value("bio", profile?.bio ?? "")} error={e.bio} />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField name="city" label={t("fields.city")} optional maxLength={80} defaultValue={value("city", profile?.city ?? "")} error={e.city} />
        <TextField name="specialties" label={t("fields.specialties")} optional maxLength={500} hint={t("fields.specialtiesHint")} defaultValue={value("specialties", profile?.specialties.join(", ") ?? "")} error={e.specialties} />
      </div>
      <TextAreaField name="links" label={t("fields.links")} optional rows={3} maxLength={1500} hint={t("fields.linksHint")} defaultValue={value("links", profile?.links.map((l) => l.url).join("\n") ?? "")} error={e.links} />
      <SubmitButton>{profile ? t("saveProfile") : t("apply")}</SubmitButton>
    </form>
  );
}

export function ResubmitForm() {
  const t = useTranslations("Designers.studio");
  const [state, action] = useActionState<FormState>(resubmitDesignerAction, IDLE);
  return (
    <form action={action} className="space-y-3">
      <FormAlert state={state} />
      <SubmitButton>{t("resubmit")}</SubmitButton>
    </form>
  );
}

/** Profile photo / cover: upload (validated by the API on content) and remove. */
export function ProfileImageForm({ slot, url }: { slot: "avatar" | "cover"; url: string | null }) {
  const t = useTranslations("Designers.studio");
  const [upState, upload] = useActionState<FormState, FormData>(uploadDesignerImageAction, IDLE);
  const [rmState, remove] = useActionState<FormState, FormData>(removeDesignerImageAction, IDLE);
  const id = useId();
  const label = slot === "avatar" ? t("avatar") : t("cover");

  return (
    <div className="space-y-3" data-testid={`profile-image-${slot}`}>
      <p className="text-sm font-semibold">{label}</p>
      <div className={cn("overflow-hidden border border-border bg-surface-muted", slot === "avatar" ? "size-24 rounded-full" : "aspect-[3/1] w-full rounded-card")}>
        {url ? (
          <AppImage src={url} alt={label} ratio="fill" sizes={slot === "avatar" ? "96px" : "600px"} />
        ) : (
          <span className="grid size-full place-items-center text-xs text-muted-foreground">
            {slot === "avatar" ? <UserRound className="size-8" aria-hidden /> : t("noImage")}
          </span>
        )}
      </div>
      <FormAlert state={upState.status !== "idle" ? upState : rmState} />
      <form action={upload} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="slot" value={slot} />
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input id={id} name="image" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby={`${id}-hint`} className="max-w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-sm file:font-semibold" />
        <SubmitButton variant="outline" className="sm:w-auto">
          <ImageUp className="size-4.5" aria-hidden />
          {t("upload")}
        </SubmitButton>
      </form>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {t("imageHint")}
      </p>
      {url ? (
        <form action={remove}>
          <input type="hidden" name="slot" value={slot} />
          <button type="submit" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-danger hover:underline">
            <Trash2 className="size-4" aria-hidden />
            {t("remove")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
