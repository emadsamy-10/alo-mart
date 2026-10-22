"use client";

import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "radix-ui";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import { AppImage } from "@/components/shared/AppImage";
import { cn } from "@/lib/utils/cn";
import type { GalleryImage } from "./types";

const ZOOM_STEPS = [1, 2, 3];

interface LightboxProps {
  images: GalleryImage[];
  productName: string;
  /** Open image index, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Return focus to the gallery slide for this index when the viewer closes. */
  onRestoreFocus?: (index: number) => void;
}

/**
 * Fullscreen image viewer. Radix Dialog provides the focus trap, Escape,
 * background scroll lock and focus restore. Zoom: buttons, +/- keys, or a
 * click/tap at a point (zooms toward that point). Zoomed images pan by
 * native scrolling (touch, wheel, trackpad) or mouse drag; pinch uses the
 * browser's native pinch-zoom. Only the visible image's large rendition is
 * requested.
 */
export function Lightbox({ images, productName, index, onIndexChange, onClose, onRestoreFocus }: LightboxProps) {
  const t = useTranslations("Gallery");
  const viewport = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const pendingAnchor = useRef<{ fx: number; fy: number; px: number; py: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean; touch: boolean } | null>(null);
  const open = index !== null;
  const current = index ?? 0;
  const image = images[current];
  const count = images.length;

  // Keep the point under the cursor fixed while zooming.
  useLayoutEffect(() => {
    const el = viewport.current;
    const anchor = pendingAnchor.current;
    if (!el) return;
    if (!anchor) {
      el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2;
      el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
      return;
    }
    el.scrollLeft = anchor.fx * el.scrollWidth - anchor.px;
    el.scrollTop = anchor.fy * el.scrollHeight - anchor.py;
    pendingAnchor.current = null;
  }, [zoom, current]);

  const zoomTo = (next: number, point?: { clientX: number; clientY: number }) => {
    const el = viewport.current;
    if (el && point) {
      const rect = el.getBoundingClientRect();
      const px = point.clientX - rect.left;
      const py = point.clientY - rect.top;
      pendingAnchor.current = { fx: (el.scrollLeft + px) / el.scrollWidth, fy: (el.scrollTop + py) / el.scrollHeight, px, py };
    }
    setZoom(Math.min(ZOOM_STEPS.at(-1)!, Math.max(1, next)));
  };
  const step = (dir: 1 | -1) => {
    const i = ZOOM_STEPS.indexOf(zoom);
    zoomTo(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, (i === -1 ? 0 : i) + dir))]);
  };

  const go = (delta: number) => {
    if (count < 2) return;
    setZoom(1);
    onIndexChange((current + delta + count) % count);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      if (zoom > 1) return; // arrows pan the zoomed image natively
      event.preventDefault();
      go(event.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : -1);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      step(1);
    } else if (event.key === "-") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "0") {
      zoomTo(1);
    }
  };

  // Mouse: drag to pan when zoomed. Touch at 1×: horizontal swipe navigates.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const el = viewport.current;
    if (!el) return;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop, moved: false, touch: e.pointerType !== "mouse" };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = viewport.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (!d.touch && zoom > 1 && e.buttons === 1) {
      el.scrollLeft = d.left - dx;
      el.scrollTop = d.top - dy;
    }
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d?.touch && zoom === 1) {
      const dx = e.clientX - d.x;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) {
        const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
        go((dx < 0) !== rtl ? 1 : -1);
      }
    }
  };
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current?.moved) return;
    zoomTo(zoom > 1 ? 1 : 2, e);
  };

  // Zoom limits use aria-disabled, not disabled: disabling the focused button
  // would push focus out of the dialog and break keyboard navigation.
  const control =
    "grid size-11 place-items-center rounded-full bg-white/10 text-panel-foreground ring-1 ring-white/15 transition hover:bg-white/20 aria-disabled:opacity-35";

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setZoom(1);
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-[60] bg-black/80" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          onCloseAutoFocus={(event) => {
            // The opener may be off-screen after navigating; focus the slide now shown instead.
            if (!onRestoreFocus) return;
            event.preventDefault();
            onRestoreFocus(current);
          }}
          aria-describedby={undefined}
          className="panel-ink fixed inset-0 z-[60] flex flex-col bg-panel text-panel-foreground outline-none"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 sm:px-6">
            <Dialog.Title className="min-w-0 truncate text-sm font-semibold sm:text-base">
              {productName}
              {count > 1 ? <span dir="ltr" className="ms-2 inline-block font-medium text-panel-muted tabular-nums">{t("position", { index: current + 1, total: count })}</span> : null}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => step(-1)} aria-disabled={zoom === 1} aria-label={t("zoomOut")} className={control}>
                <Minus className="size-5" aria-hidden />
              </button>
              <span className="w-12 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button type="button" onClick={() => step(1)} aria-disabled={zoom === ZOOM_STEPS.at(-1)} aria-label={t("zoomIn")} className={control}>
                <Plus className="size-5" aria-hidden />
              </button>
              <Dialog.Close aria-label={t("close")} className={cn(control, "ms-2 bg-white text-(--panel-bg) hover:bg-white/90")}>
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {/* LTR scroll coordinates inside the viewport keep the zoom math direction-agnostic. */}
            <div
              ref={viewport}
              dir="ltr"
              data-testid="lightbox-viewport"
              data-zoom={zoom}
              onClick={onClick}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className={cn(
                "scrollbar-none absolute inset-0 overflow-auto [touch-action:pan-x_pan-y_pinch-zoom]",
                zoom > 1 ? "cursor-zoom-out active:cursor-grabbing" : "cursor-zoom-in",
              )}
            >
              {image ? (
                <div className="relative" style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}>
                  <AppImage
                    key={image.id}
                    src={image.large ?? image.main}
                    alt={image.alt}
                    ratio="fill"
                    fit="contain"
                    priority
                    quality={85}
                    sizes={zoom > 1 ? "100vw" : "(min-width: 1024px) 80vw, 100vw"}
                    fallbackLabel={t("noImage")}
                    className="select-none"
                    draggable={false}
                  />
                </div>
              ) : null}
            </div>

            {count > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t("previous")} className={cn(control, "absolute start-3 top-1/2 -translate-y-1/2 sm:start-6")}>
                  <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t("next")} className={cn(control, "absolute end-3 top-1/2 -translate-y-1/2 sm:end-6")}>
                  <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
                </button>
              </>
            ) : null}
          </div>

          {count > 1 ? (
            <ul aria-label={t("thumbnails")} className="scrollbar-none flex justify-center gap-2 overflow-x-auto px-4 pt-3 [&>li]:p-0.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {images.map((img, i) => (
                <li key={img.id} className="w-14 shrink-0 sm:w-16">
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      onIndexChange(i);
                    }}
                    aria-label={t("showImage", { index: i + 1, total: count })}
                    aria-current={i === current ? "true" : undefined}
                    className={cn("block w-full overflow-hidden rounded-lg bg-image-well ring-2 transition", i === current ? "ring-white" : "ring-transparent opacity-60 hover:opacity-100")}
                  >
                    <AppImage src={img.thumb} alt="" ratio="1/1" sizes="64px" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="pb-[env(safe-area-inset-bottom)]" />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
