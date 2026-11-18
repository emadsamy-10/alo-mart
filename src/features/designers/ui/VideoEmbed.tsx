"use client";

import { ExternalLink, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { VideoMedia } from "../schemas";

const PROVIDER = { youtube: "YouTube", vimeo: "Vimeo" } as const;

/**
 * Click-to-load video: nothing is requested from YouTube/Vimeo until the
 * visitor presses play. The iframe src is the embed URL the API rebuilt from
 * an allow-listed provider id (never a user-supplied URL). The external link
 * stays available if the provider refuses the embed.
 */
export function VideoEmbed({ video }: { video: VideoMedia }) {
  const t = useTranslations("Designers.video");
  const [playing, setPlaying] = useState(false);
  const provider = PROVIDER[video.provider];
  const title = video.alt_text ?? t("fallbackTitle");

  return (
    <figure className="space-y-2" data-testid="video">
      <div className="relative aspect-video overflow-hidden rounded-card bg-ink">
        {playing ? (
          <iframe
            src={`${video.embed_url}?autoplay=1`}
            title={title}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            loading="lazy"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink-foreground focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand"
            aria-label={t("play", { title })}
          >
            <span className="grid size-16 place-items-center rounded-full bg-brand text-brand-foreground shadow-lg transition group-hover:scale-105">
              <Play className="size-7 translate-x-0.5" aria-hidden />
            </span>
            <span className="px-4 text-center text-sm font-semibold">{title}</span>
            <span className="px-4 text-center text-xs opacity-80">{t("consent", { provider })}</span>
          </button>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>{playing ? t("unavailable", { provider }) : null}</span>
        <a href={video.watch_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-text hover:underline">
          {t("open", { provider })}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </figcaption>
    </figure>
  );
}
