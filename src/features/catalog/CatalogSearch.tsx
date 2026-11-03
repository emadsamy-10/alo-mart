"use client";

import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils/cn";
import { useCatalog } from "./CatalogNavigation";
import { SEARCH_MAX, SEARCH_MIN, normalizeSearch, withPatch } from "./filters";

/**
 * Catalog search. Submits on Enter / the search button (no keystroke
 * debounce: every query is a server request and a half-typed Arabic word is
 * not a useful one). The term combines with every active filter; a new term
 * returns to page 1. Clearing removes only the term.
 */
export function CatalogSearch({ className }: { className?: string }) {
  const t = useTranslations("Catalog");
  const { state, navigate, pending } = useCatalog();
  const [value, setValue] = useState(state.q ?? "");
  const [error, setError] = useState(false);
  // Back/Forward or a chip removal changed the term: show the URL's value
  // (adjusted during render, so the field keeps focus — no remount, no effect).
  const [syncedQ, setSyncedQ] = useState(state.q);
  if (syncedQ !== state.q) {
    setSyncedQ(state.q);
    setValue(state.q ?? "");
    setError(false);
  }
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (trimmed === "") {
      if (state.q) navigate(withPatch(state, { q: null }));
      return;
    }
    const q = normalizeSearch(trimmed);
    if (!q) {
      setError(true);
      input.current?.focus();
      return;
    }
    setError(false);
    if (q !== state.q) navigate(withPatch(state, { q }), { scroll: true });
  };

  const clear = () => {
    setValue("");
    setError(false);
    if (state.q) navigate(withPatch(state, { q: null }));
    input.current?.focus();
  };

  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)} data-testid="catalog-search">
      <label htmlFor="catalog-q" className="sr-only">
        {t("searchLabel")}
      </label>
      <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        id="catalog-q"
        name="q"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={SEARCH_MAX}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setError(false);
        }}
        placeholder={t("searchPlaceholder")}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "h-13 w-full rounded-full border bg-surface ps-12 pe-26 text-[0.9375rem] shadow-card outline-none transition-colors placeholder:text-muted-foreground/80 [&::-webkit-search-cancel-button]:hidden",
          "focus-visible:border-ink focus-visible:ring-2 focus-visible:ring-(--focus-ring)/25",
          error ? "border-danger" : "border-border",
        )}
      />
      <div className="absolute end-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label={t("clearSearch")}
            className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label={t("searchSubmit")}
          disabled={pending}
          className="grid h-10 w-12 place-items-center rounded-full bg-ink text-ink-foreground transition hover:bg-ink/90 disabled:opacity-70"
        >
          <Search className="size-4" aria-hidden />
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="absolute start-4 top-full mt-1.5 text-xs font-medium text-danger">
          {t("searchTooShort", { min: SEARCH_MIN })}
        </p>
      ) : null}
    </form>
  );
}
