"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition, type MouseEvent, type ReactNode } from "react";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { catalogHref, type CatalogState } from "./filters";

interface CatalogNavigation {
  /**
   * The state the shopper is heading to: the server's state, overlaid with
   * changes whose navigation is still in flight. Every control derives its
   * NEXT state from this, so two quick clicks (brand A, then brand B) add up
   * instead of the second one overwriting the first.
   */
  state: CatalogState;
  /** True while a catalog navigation is in flight: counts and results are about to change. */
  pending: boolean;
  navigate: (next: CatalogState, options?: { scroll?: boolean }) => void;
}

const Ctx = createContext<CatalogNavigation | null>(null);

/**
 * URL-driven catalog navigation. The URL is the only source of truth: a
 * change is a router push to the canonical URL of the next state, the page
 * re-renders on the server with fresh listing + facets, and Back/Forward and
 * refresh restore everything. All pushes share ONE transition, so the
 * router keeps only the latest navigation — a slow response for an older
 * filter set can never replace a newer one.
 */
export function CatalogNavigationProvider({ state, children }: { state: CatalogState; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(state);

  const navigate = useCallback(
    (next: CatalogState, options?: { scroll?: boolean }) => {
      startTransition(() => {
        setOptimistic(next);
        router.push(catalogHref(next), { scroll: options?.scroll ?? false });
      });
    },
    [router, setOptimistic],
  );

  const value = useMemo(() => ({ state: optimistic, pending, navigate }), [optimistic, pending, navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCatalog(): CatalogNavigation {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCatalog must be used inside <CatalogNavigationProvider>");
  return value;
}

/**
 * A real, crawlable link to a catalog state (works without JavaScript and
 * with open-in-new-tab) that, on a plain click, navigates inside the shared
 * catalog transition instead.
 */
export function CatalogLink({
  to,
  scroll = false,
  className,
  children,
  ...rest
}: {
  to: CatalogState;
  scroll?: boolean;
  className?: string;
  children: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  const { navigate } = useCatalog();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to, { scroll });
  };
  return (
    <Link href={catalogHref(to)} scroll={scroll} onClick={onClick} className={className} {...rest}>
      {children}
    </Link>
  );
}
