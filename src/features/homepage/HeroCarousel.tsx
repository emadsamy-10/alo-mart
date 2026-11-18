"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Hero slides on a native scroll-snap track (swipe on touch). Slides are server
 * HTML passed as children; only the controls hydrate. No autoplay: it moves
 * only when the shopper asks. One slide shows no controls at all.
 */
export function HeroCarousel({ children, className }: { children: ReactNode; className?: string }) {
  const t = useTranslations("Hero");
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const measure = useCallback(() => {
    const el = track.current;
    if (el) setIndex(Math.round(Math.abs(el.scrollLeft) / Math.max(el.clientWidth, 1)));
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    return () => el.removeEventListener("scroll", measure);
  }, [measure]);

  const go = (target: number) => {
    const el = track.current;
    if (!el) return;
    const next = (target + slides.length) % slides.length;
    const rtl = getComputedStyle(el).direction === "rtl";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: el.clientWidth * next * (rtl ? -1 : 1), behavior: reduce ? "auto" : "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-on-media text-on-media-foreground shadow-raised transition-transform hover:scale-105 lg:grid";

  return (
    <div className={cn("relative overflow-hidden rounded-panel bg-image-well", className)} data-testid="hero">
      <div ref={track} className="scrollbar-none flex h-full snap-x snap-mandatory overflow-x-auto">
        {slides.map((slide, i) => (
          <div key={i} className="relative h-full w-full shrink-0 snap-start snap-always" aria-hidden={i !== index || undefined} inert={i !== index || undefined}>
            {slide}
          </div>
        ))}
      </div>
      {slides.length > 1 ? (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label={t("previousSlide")} className={cn(arrow, "start-4")} data-testid="hero-previous">
            <ChevronRight className="size-5 ltr:rotate-180" aria-hidden />
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label={t("nextSlide")} className={cn(arrow, "end-4")} data-testid="hero-next">
            <ChevronLeft className="size-5 ltr:rotate-180" aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-1.5 z-10 flex justify-center gap-0.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={t("goToSlide", { number: i + 1 })}
                aria-current={i === index || undefined}
                className="grid size-6 place-items-center"
              >
                <span className={cn("size-2 rounded-full ring-1 ring-black/10 transition-colors", i === index ? "bg-brand" : "bg-on-media/80")} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
