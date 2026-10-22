"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Children, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { SectionHeading } from "./SectionHeading";

interface CarouselProps {
  headingId: string;
  title: string;
  subtitle?: string | null;
  /** Server-rendered extra action (e.g. "View all" link). */
  action?: ReactNode;
  tone?: "default" | "panel";
  /** Tailwind width classes for each slide. */
  itemClassName?: string;
  children: ReactNode;
}

/**
 * Native scroll-snap row (swipe on touch, trackpad on desktop) with explicit
 * previous/next buttons on larger screens. No autoplay. Slides are server
 * HTML passed as children — only the controls hydrate. Directions follow the
 * document direction, so "next" moves toward the inline end in RTL too.
 */
export function Carousel({ headingId, title, subtitle, action, tone = "default", itemClassName, children }: CarouselProps) {
  const t = useTranslations("Sections");
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const offset = Math.abs(el.scrollLeft); // negative in RTL
    setEdges({ start: offset < 4, end: offset + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [measure]);

  function scroll(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: el.clientWidth * 0.85 * direction * (rtl ? -1 : 1), behavior: reduce ? "auto" : "smooth" });
  }

  const controlClass = cn(
    "hidden size-11 items-center justify-center rounded-full border transition-colors disabled:opacity-35 lg:inline-flex",
    tone === "panel"
      ? "border-white/15 text-panel-foreground hover:bg-white/10"
      : "border-border bg-surface text-foreground shadow-sm hover:border-border-strong",
  );

  return (
    <>
      <SectionHeading
        id={headingId}
        title={title}
        subtitle={subtitle}
        tone={tone}
        action={
          <>
            {action}
            <button
              type="button"
              className={controlClass}
              onClick={() => scroll(-1)}
              disabled={edges.start}
              aria-label={t("scrollPrevious", { title })}
            >
              <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden />
            </button>
            <button
              type="button"
              className={controlClass}
              onClick={() => scroll(1)}
              disabled={edges.end}
              aria-label={t("scrollNext", { title })}
            >
              <ChevronRight className="size-5 rtl:rotate-180" aria-hidden />
            </button>
          </>
        }
      />
      <ul
        ref={trackRef}
        className="scrollbar-none -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-2 pb-5 sm:-mx-6 sm:scroll-px-6 sm:gap-4 sm:px-6 lg:-mx-2 lg:scroll-px-2 lg:gap-5 lg:px-2"
      >
        {/* toArray drops null/false children (e.g. an absent lead card); Children.map would render them as empty slots. */}
        {Children.toArray(children).map((child) => (
          <li key={isValidElement(child) && child.key != null ? child.key : undefined} className={cn("shrink-0 snap-start", itemClassName)}>
            {child}
          </li>
        ))}
      </ul>
    </>
  );
}
