"use client";

import { ArrowDown, ArrowUp, ImageUp, Star, Trash2, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { IDLE, type FormState } from "@/features/account/form-state";
import { CheckboxField, FormAlert, SelectField, SubmitButton, TextField } from "@/features/account/ui/fields";
import {
  addDesignVideoAction,
  createDesignAction,
  removeDesignMediaAction,
  reorderDesignMediaAction,
  setDesignCoverAction,
  updateDesignAction,
  uploadDesignImageAction,
} from "../actions";
import type { OwnDesign, StudioLimits } from "../schemas";
import { TextAreaField } from "./StudioForms";

/** Title, description, category, tags, members-only flag. Creates a draft or saves edits. */
export function DesignForm({ design, categories }: { design: OwnDesign | null; categories: { code: string; name: string }[] }) {
  const t = useTranslations("Designers.studio");
  const [state, action] = useActionState<FormState, FormData>(design ? updateDesignAction : createDesignAction, IDLE);
  const v = state.values;
  const e = state.fieldErrors ?? {};
  const locked = design?.status === "pending_review";

  return (
    <form action={action} noValidate className="space-y-5" data-testid="design-form">
      {design ? <input type="hidden" name="design_id" value={design.id} /> : null}
      <FormAlert state={state} />
      <fieldset disabled={locked} className="min-w-0 space-y-5 disabled:opacity-70">
        <TextField name="title" label={t("designForm.title")} required minLength={3} maxLength={120} defaultValue={v?.title ?? design?.title ?? ""} error={e.title} />
        <SelectField name="category" label={t("designForm.category")} required defaultValue={v?.category ?? design?.category ?? ""} error={e.category}>
          <option value="" disabled>
            {t("designForm.chooseCategory")}
          </option>
          {categories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <TextAreaField name="description" label={t("designForm.description")} optional rows={6} maxLength={5000} defaultValue={v?.description ?? design?.description ?? ""} error={e.description} />
        <TextField name="tags" label={t("designForm.tags")} optional maxLength={400} hint={t("designForm.tagsHint")} defaultValue={v?.tags ?? design?.tags.join(", ") ?? ""} error={e.tags} />
        <div>
          <CheckboxField name="members_only" label={t("designForm.membersOnly")} defaultChecked={v ? v.members_only === "on" : (design?.members_only ?? false)} />
          <p className="text-xs text-muted-foreground">{t("designForm.membersOnlyHint")}</p>
        </div>
        <SubmitButton>{design ? t("designForm.save") : t("designForm.create")}</SubmitButton>
      </fieldset>
    </form>
  );
}

function MediaAction({ action, fields, label, icon, danger }: { action: (prev: FormState, form: FormData) => Promise<FormState>; fields: Record<string, string | number>; label: string; icon: React.ReactNode; danger?: boolean }) {
  const [state, run] = useActionState(action, IDLE);
  return (
    <form action={run}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold hover:bg-surface-muted ${danger ? "text-danger" : ""}`} aria-label={label} title={label}>
        {icon}
        <span className="sr-only sm:not-sr-only">{label}</span>
      </button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** Ordered photos (cover, move, remove, upload) and YouTube/Vimeo links. Quotas come from the API. */
export function MediaManager({ design, limits }: { design: OwnDesign; limits: StudioLimits }) {
  const t = useTranslations("Designers.studio");
  const [upState, upload] = useActionState<FormState, FormData>(uploadDesignImageAction, IDLE);
  const [videoState, addVideo] = useActionState<FormState, FormData>(addDesignVideoAction, IDLE);
  const fileId = useId();
  const locked = design.status === "pending_review";
  const order = [...design.images, ...design.videos].sort((a, b) => a.sort_order - b.sort_order).map((m) => m.id);
  /** Swap a photo with its neighbouring PHOTO; the API needs the full media order (photos and videos). */
  const moved = (id: number, delta: number) => {
    const photos = design.images.map((m) => m.id);
    const neighbour = photos[photos.indexOf(id) + delta];
    if (neighbour === undefined) return null;
    const next = [...order];
    const a = next.indexOf(id);
    const b = next.indexOf(neighbour);
    [next[a], next[b]] = [next[b], next[a]];
    return next.join(",");
  };
  const coverId = design.cover_media_id ?? design.images[0]?.id ?? null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="photos-heading" className="space-y-4">
        <div>
          <h3 id="photos-heading" className="text-lg font-bold">
            {t("photos")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("photosHint", { count: design.images.length, max: limits.max_images_per_design })}</p>
        </div>
        {design.images.length ? (
          <ol className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-3" data-testid="design-images">
            {design.images.map((img, index) => {
              const up = moved(img.id, -1);
              const down = moved(img.id, 1);
              return (
                <li key={img.id} className="overflow-hidden rounded-card border border-border bg-surface">
                  <div className="relative">
                    <AppImage src={img.url} unoptimized={img.protected} alt={img.alt_text ?? t("photos")} ratio="4/3" sizes="(min-width: 1024px) 20vw, 50vw" />
                    {img.id === coverId ? (
                      <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-ink-foreground">
                        <Star className="size-3.5" aria-hidden />
                        {t("isCover")}
                      </span>
                    ) : null}
                  </div>
                  {!locked ? (
                    <div className="flex flex-wrap items-center gap-1 p-2">
                      {img.id !== coverId ? <MediaAction action={setDesignCoverAction} fields={{ design_id: design.id, media_id: img.id }} label={t("setCover")} icon={<Star className="size-4" aria-hidden />} /> : null}
                      {up && index > 0 ? <MediaAction action={reorderDesignMediaAction} fields={{ design_id: design.id, order: up }} label={t("moveUp")} icon={<ArrowUp className="size-4" aria-hidden />} /> : null}
                      {down && index < design.images.length - 1 ? <MediaAction action={reorderDesignMediaAction} fields={{ design_id: design.id, order: down }} label={t("moveDown")} icon={<ArrowDown className="size-4" aria-hidden />} /> : null}
                      <MediaAction action={removeDesignMediaAction} fields={{ design_id: design.id, media_id: img.id }} label={t("removeMedia")} icon={<Trash2 className="size-4" aria-hidden />} danger />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
        {!locked && design.images.length < limits.max_images_per_design ? (
          <form action={upload} className="space-y-3 rounded-2xl border border-dashed border-border-strong p-4" data-testid="upload-image-form">
            <input type="hidden" name="design_id" value={design.id} />
            <FormAlert state={upState} />
            <div className="space-y-1.5">
              <label htmlFor={fileId} className="text-sm font-semibold">
                {t("addPhoto")}
              </label>
              <input id={fileId} name="image" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby={`${fileId}-hint`} className="block max-w-full text-sm file:me-3 file:rounded-full file:border-0 file:bg-surface-muted file:px-4 file:py-2 file:text-sm file:font-semibold" />
              <p id={`${fileId}-hint`} className="text-xs text-muted-foreground">
                {t("imageHint")}
              </p>
            </div>
            <TextField name="alt_text" label={t("altText")} optional maxLength={200} />
            <SubmitButton variant="outline" pendingLabel={t("uploading")}>
              <ImageUp className="size-4.5" aria-hidden />
              {t("uploadPhoto")}
            </SubmitButton>
          </form>
        ) : null}
      </section>

      <section aria-labelledby="videos-heading" className="space-y-4">
        <div>
          <h3 id="videos-heading" className="text-lg font-bold">
            {t("videos")}
          </h3>
          <p className="text-sm text-muted-foreground">{t("videosHint", { count: design.videos.length, max: limits.max_videos_per_design })}</p>
        </div>
        {design.videos.length ? (
          <ul className="space-y-2" data-testid="design-videos">
            {design.videos.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-2">
                <a href={v.watch_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 min-w-0 items-center gap-2 text-sm font-semibold break-all hover:underline" dir="ltr">
                  <Video className="size-4.5 shrink-0" aria-hidden />
                  {v.alt_text ?? v.watch_url}
                </a>
                {!locked ? <MediaAction action={removeDesignMediaAction} fields={{ design_id: design.id, media_id: v.id }} label={t("removeMedia")} icon={<Trash2 className="size-4" aria-hidden />} danger /> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {!locked && design.videos.length < limits.max_videos_per_design ? (
          <form action={addVideo} className="space-y-3 rounded-2xl border border-dashed border-border-strong p-4" noValidate data-testid="add-video-form">
            <input type="hidden" name="design_id" value={design.id} />
            <FormAlert state={videoState} />
            <TextField name="url" type="url" inputMode="url" dir="ltr" label={t("videoUrl")} hint={t("videoUrlHint")} required maxLength={500} defaultValue={videoState.status === "error" ? (videoState.values?.url ?? "") : ""} error={videoState.fieldErrors?.url} />
            <TextField name="title" label={t("videoTitle")} optional maxLength={200} />
            <SubmitButton variant="outline">{t("addVideo")}</SubmitButton>
          </form>
        ) : null}
      </section>
    </div>
  );
}
