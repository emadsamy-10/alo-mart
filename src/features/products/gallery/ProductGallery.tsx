"use client";

import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { cn } from "@/lib/utils/cn";
import { Lightbox } from "./Lightbox";
import type { GalleryImage } from "./types";

const isRtl = (el: HTMLElement | null) => !!el && getComputedStyle(el).direction === "rtl";

/**
 * Product gallery: a native scroll-snap track (swipe on touch, arrows and
 * thumbnails on desktop) whose slides open a zoomable lightbox. Only the
 * first slide loads eagerly; thumbnails use the small rendition and the
 * lightbox requests the large one only when opened. Callers remount it (key)
 * when the image set changes, e.g. on variant selection.
 */
export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const t = useTranslations("Gallery");
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const count = images.length;

  const goTo = useCallback(
    (next: number) => {
      const el = track.current;
      if (!el || count === 0) return;
      const target = (next + count) % count;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: target * el.clientWidth * (isRtl(el) ? -1 : 1), behavior: reduce ? "instant" : "smooth" });
      setIndex(target);
    },
    [count],
  );

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (next !== index && next >= 0 && next < count) setIndex(next);
  };

  // Arrow keys follow the reading direction: "forward" is left in RTL.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (count < 2 || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    const forward = event.key === (isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight");
    event.preventDefault();
    goTo(index + (forward ? 1 : -1));
  };

  if (count === 0) {
    return (
      <div className="overflow-hidden rounded-panel bg-image-well">
        <AppImage src={null} alt={productName} ratio="1/1" fallbackLabel={t("noImage")} />
      </div>
    );
  }

  const arrow =
    "absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-on-media/90 text-on-media-foreground shadow-raised backdrop-blur transition hover:bg-on-media focus-visible:outline-2";

  return (
    <div
      role="region"
      aria-roledescription={t("carousel")}
      aria-label={t("gallery", { name: productName })}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-3 lg:flex-row-reverse lg:items-start lg:gap-4"
    >
      <div className="relative min-w-0 flex-1">
        <ul
          ref={track}
          onScroll={onScroll}
          className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-panel bg-image-well"
          data-testid="gallery-track"
        >
          {images.map((image, i) => (
            <li key={image.id} className="w-full shrink-0 snap-center" aria-hidden={i !== index || undefined}>
              <button
                type="button"
                tabIndex={i === index ? 0 : -1}
                onClick={() => setViewer(i)}
                aria-label={t("openViewer", { index: i + 1, total: count })}
                className="group relative block w-full cursor-zoom-in"
              >
                <AppImage
                  src={image.main}
                  alt={image.alt}
                  ratio="1/1"
                  fit="contain"
                  priority={i === 0}
                  quality={85}
                  fallbackLabel={t("noImage")}
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.03]"
                />
              </button>
            </li>
          ))}
        </ul>

        <span className="pointer-events-none absolute end-4 top-4 grid size-10 place-items-center rounded-full bg-on-media/90 text-on-media-foreground shadow-card" aria-hidden>
          <Expand className="size-4" />
        </span>

        {count > 1 ? (
          <>
            <button type="button" onClick={() => goTo(index - 1)} aria-label={t("previous")} className={cn(arrow, "start-3")}>
              <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            </button>
            <button type="button" onClick={() => goTo(index + 1)} aria-label={t("next")} className={cn(arrow, "end-3")}>
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </button>
            <p aria-live="polite" dir="ltr" className="absolute inset-x-0 bottom-4 mx-auto w-fit rounded-full bg-scrim px-3 py-1 text-xs font-semibold text-white tabular-nums">
              {t("position", { index: index + 1, total: count })}
            </p>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <ul aria-label={t("thumbnails")} className="scrollbar-none -m-1 flex gap-2.5 overflow-x-auto p-1 lg:max-h-[min(36rem,46vw)] lg:w-[6rem] lg:shrink-0 lg:flex-col lg:overflow-y-auto">
          {images.map((image, i) => (
            <li key={image.id} className="w-20 shrink-0 lg:w-full">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={t("showImage", { index: i + 1, total: count })}
                aria-current={i === index ? "true" : undefined}
                data-testid="gallery-thumb"
                className={cn(
                  "block w-full overflow-hidden rounded-well bg-image-well ring-2 ring-offset-2 ring-offset-background transition",
                  i === index ? "ring-ink" : "ring-transparent opacity-70 hover:opacity-100",
                )}
              >
                <AppImage src={image.thumb} alt="" ratio="1/1" sizes="96px" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Lightbox
        images={images}
        productName={productName}
        index={viewer}
        onIndexChange={(i) => {
          setViewer(i);
          goTo(i);
        }}
        onClose={() => setViewer(null)}
        onRestoreFocus={(i) => track.current?.querySelectorAll<HTMLButtonElement>(":scope > li > button")[i]?.focus({ preventScroll: true })}
      />
    </div>
  );
}
