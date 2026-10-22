"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Sticky shell for the main header row: borderless at rest, a hairline and a
 * soft shadow once the page scrolls under it. A zero-height sentinel above the bar
 * drives the state (no scroll listeners).
 */
export function StickyHeader({ children, className }: { children: ReactNode; className?: string }) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-0" />
      <header
        data-stuck={stuck || undefined}
        className={cn(
          // At rest the header blends into the page so the capsule floats; once content
          // scrolls under it, a hairline and a soft shadow separate it.
          "sticky top-0 z-40 border-b border-transparent bg-background/90 backdrop-blur-xl transition-[box-shadow,border-color] duration-(--duration-base) supports-[backdrop-filter]:bg-background/80",
          "data-stuck:border-border/70 data-stuck:shadow-[0_10px_30px_-18px_rgb(20_32_47/0.35)] dark:data-stuck:shadow-[0_10px_30px_-14px_rgb(0_0_0/0.7)]",
          className,
        )}
      >
        {children}
      </header>
    </>
  );
}
