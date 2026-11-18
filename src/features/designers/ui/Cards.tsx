import { Images, Lock, PenTool, PlayCircle, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { AppImage } from "@/components/shared/AppImage";
import { Link } from "@/lib/i18n/navigation";
import type { DesignCard as DesignCardData, DesignerCard as DesignerCardData } from "../schemas";

/** Image-first design card: cover, title, designer, real media counts (no invented badges). */
export function DesignCard({ design, headingLevel = 3 }: { design: DesignCardData; headingLevel?: 2 | 3 }) {
  const t = useTranslations("Designers");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card transition hover:border-border-strong" data-testid="design-card">
      <div className="relative">
        <AppImage src={design.cover?.url} unoptimized={design.cover?.protected} alt={design.cover?.alt_text ?? ""} ratio="4/3" sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" fallbackLabel={design.title} />
        <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
          {design.members_only ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-ink-foreground">
              <Lock className="size-3.5" aria-hidden />
              {t("card.membersOnly")}
            </span>
          ) : null}
          {design.videos_count > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/85 px-2.5 py-1 text-xs font-semibold text-ink-foreground">
              <PlayCircle className="size-3.5" aria-hidden />
              {t("card.video")}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-semibold text-brand-text">{t(`categories.${design.category}` as never)}</p>
        <Heading dir="auto" className="line-clamp-2 font-bold">
          <Link href={`/designs/${design.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {design.title}
          </Link>
        </Heading>
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm text-muted-foreground">
          {design.designer ? <span className="truncate">{t("card.by", { name: design.designer.display_name })}</span> : <span />}
          <span className="inline-flex shrink-0 items-center gap-1">
            <Images className="size-4" aria-hidden />
            {t("card.photos", { count: design.images_count })}
          </span>
        </div>
      </div>
    </article>
  );
}

/** Designer profile card: cover strip, avatar, name, headline, specialties. */
export function DesignerCard({ designer, headingLevel = 3 }: { designer: DesignerCardData; headingLevel?: 2 | 3 }) {
  const t = useTranslations("Designers");
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-card transition hover:border-border-strong" data-testid="designer-card">
      <div className="h-24 bg-surface-muted">
        {designer.cover_url ? <AppImage src={designer.cover_url} alt="" ratio="fill" sizes="(min-width: 1024px) 25vw, 50vw" /> : null}
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pb-5 text-center">
        <span className="-mt-10 block size-20 overflow-hidden rounded-full bg-surface ring-4 ring-surface">
          {designer.avatar_url ? (
            <AppImage src={designer.avatar_url} alt="" ratio="1/1" sizes="80px" />
          ) : (
            <span className="grid size-full place-items-center bg-surface-muted text-muted-foreground" aria-hidden>
              <UserRound className="size-8" />
            </span>
          )}
        </span>
        <Heading dir="auto" className="mt-3 font-bold">
          <Link href={`/designers/${designer.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {designer.display_name}
          </Link>
        </Heading>
        {designer.headline ? <p dir="auto" className="mt-1 line-clamp-2 text-sm text-muted-foreground">{designer.headline}</p> : null}
        {designer.specialties.length ? (
          <ul className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label={t("designer.specialties")}>
            {designer.specialties.slice(0, 3).map((s) => (
              <li key={s} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium">
                {s}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-auto inline-flex items-center gap-1 pt-3 text-sm text-muted-foreground">
          <PenTool className="size-4" aria-hidden />
          {t("card.designs", { count: designer.designs_count })}
        </p>
      </div>
    </article>
  );
}
