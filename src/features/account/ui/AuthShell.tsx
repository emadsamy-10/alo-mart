import type { ReactNode } from "react";
import { Container } from "@/components/shared/Container";

/** Centered card for the sign-in family of pages (login, register, recovery, verification). */
export function AuthShell({ title, intro, children, aside }: { title: string; intro?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <Container className="py-8 sm:py-14">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-panel border border-border bg-surface px-5 py-7 shadow-card sm:px-8 sm:py-9">
          <h1 className="tracking-display text-2xl font-extrabold text-balance sm:text-3xl">{title}</h1>
          {intro ? <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">{intro}</p> : null}
          <div className="mt-7">{children}</div>
        </div>
        {aside ? <div className="mt-5 text-center text-sm text-muted-foreground">{aside}</div> : null}
      </div>
    </Container>
  );
}
