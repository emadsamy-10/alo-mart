"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky shell of the whole header. It pins with a negative `top`, so its first
 * row simply scrolls away and the height of the page never changes (no layout
 * shift). A zero-height sentinel reports when that happened: `data-stuck` then
 * reveals the compact items of the pinned row and a soft shadow.
 */
export function StickyHeader({ children, className }: { children: ReactNode; className?: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    const bar = header.current;
    if (!el || !bar) return;
    let observer: IntersectionObserver | null = null;
    // The collapse distance changes at the desktop breakpoint, so measure it again on resize.
    const observe = () => {
      observer?.disconnect();
      const collapse = Math.abs(parseFloat(getComputedStyle(bar).top) || 0);
      observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), { rootMargin: `${collapse}px 0px 0px 0px` });
      observer.observe(el);
    };
    observe();
    window.addEventListener("resize", observe, { passive: true });
    return () => {
      window.removeEventListener("resize", observe);
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-0" />
      <header
        ref={header}
        data-stuck={stuck || undefined}
        className={cn(
          "group/header sticky top-[calc(-1*var(--header-collapse))] z-40 bg-surface shadow-[0_1px_0_0_var(--border)] transition-shadow duration-(--duration-base)",
          "data-stuck:shadow-[0_1px_0_0_var(--border),0_12px_28px_-20px_rgb(15_30_48/0.45)] dark:data-stuck:shadow-[0_1px_0_0_var(--border),0_12px_28px_-14px_rgb(0_0_0/0.7)]",
          className,
        )}
      >
        {children}
      </header>
    </>
  );
}
