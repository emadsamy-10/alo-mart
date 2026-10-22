import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface StatusPanelProps {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "neutral" | "error";
  /** Heading level — h1 for full-page states, h2 inside a page. */
  headingLevel?: 1 | 2;
  className?: string;
}

/**
 * Shared shell for empty, error and not-found states. Empty and error use
 * different tones and copy so a failure is never mistaken for an empty catalog.
 */
export function StatusPanel({ icon, title, body, action, tone = "neutral", headingLevel = 2, className }: StatusPanelProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "flex flex-col items-center rounded-panel border px-6 py-12 text-center sm:py-16",
        tone === "error" ? "border-danger/20 bg-danger-soft/60" : "border-border bg-surface",
        className,
      )}
    >
      <span
        className={cn(
          "mb-5 grid size-14 place-items-center rounded-full",
          tone === "error" ? "bg-danger-soft text-danger" : "bg-surface-muted text-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <Heading className="tracking-display max-w-md text-xl font-bold text-balance sm:text-2xl">{title}</Heading>
      {body ? <p className="mt-2 max-w-md text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">{body}</p> : null}
      {action ? <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div> : null}
    </div>
  );
}
