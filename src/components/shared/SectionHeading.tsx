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
    <div className={cn("mb-4 flex items-center justify-between gap-4 sm:mb-5", className)}>
      <div className="min-w-0">
        <h2
          id={id}
          className={cn(
            "tracking-display flex items-center gap-3 text-[1.25rem] leading-tight font-extrabold text-balance sm:text-[1.5rem]",
            tone === "panel" ? "text-panel-foreground" : "text-foreground",
          )}
        >
          <span className="h-0.5 w-7 shrink-0 rounded-full bg-brand" aria-hidden />
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

/** Quiet red "View more ‹" text link, with a 44px touch target. */
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
      className={cn(
        "inline-flex h-11 items-center gap-1.5 px-1 text-sm font-bold whitespace-nowrap transition-colors hover:underline hover:underline-offset-4",
        tone === "panel" ? "text-panel-foreground" : "text-brand-text",
      )}
    >
      {label}
      {accessibleLabel ? <span className="sr-only"> {accessibleLabel}</span> : null}
      <ChevronLeft className="size-4 ltr:rotate-180" aria-hidden />
    </Link>
  );
}
