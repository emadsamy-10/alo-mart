import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
  id: string;
  title: string;
  subtitle?: string | null;
  /** Trailing slot: "view all" link, carousel controls… */
  action?: ReactNode;
  tone?: "default" | "panel";
  className?: string;
}

/** Every homepage section is an <h2>; the page <h1> lives in the hero. */
export function SectionHeading({ id, title, subtitle, action, tone = "default", className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-5 flex items-end justify-between gap-4 sm:mb-7", className)}>
      <div className="min-w-0">
        <h2
          id={id}
          className={cn(
            "tracking-display text-[1.5rem] leading-tight font-extrabold text-balance sm:text-[1.75rem] lg:text-[2rem]",
            tone === "panel" ? "text-panel-foreground" : "text-foreground",
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p className={cn("mt-1.5 text-sm leading-relaxed sm:text-base", tone === "panel" ? "text-panel-muted" : "text-muted-foreground")}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  );
}

/** Quiet "View all ‹" text link (approved design), with a 44px touch target. */
export function ViewAllLink({
  href,
  label,
  accessibleLabel,
  tone = "default",
}: {
  href: string;
  label: string;
  accessibleLabel?: string;
  tone?: "default" | "panel";
}) {
  return (
    <Link
      href={href}
      aria-label={accessibleLabel}
      className={cn(
        // Same height and border language as the carousel arrows beside it (44px).
        "inline-flex h-11 items-center gap-1.5 rounded-full border ps-4 pe-3 text-sm font-semibold transition-colors",
        tone === "panel"
          ? "border-white/15 text-panel-foreground hover:bg-white/10"
          : "border-border bg-surface text-foreground shadow-sm hover:border-border-strong hover:text-brand-text",
      )}
    >
      {label}
      <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
    </Link>
  );
}
