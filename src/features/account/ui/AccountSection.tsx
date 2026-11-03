import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** A titled card inside an account page. */
export function AccountSection({ title, description, children, action, className, id }: { title: string; description?: string; children: ReactNode; action?: ReactNode; className?: string; id?: string }) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("rounded-panel border border-border bg-surface p-5 shadow-card sm:p-7", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-bold sm:text-xl">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AccountHeading({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className="mb-6">
      <h1 className="tracking-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {intro ? <p className="mt-2 text-muted-foreground">{intro}</p> : null}
    </div>
  );
}
