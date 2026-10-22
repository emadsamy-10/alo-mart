import { cn } from "@/lib/utils/cn";

/**
 * Button styling shared by <button> and links-styled-as-buttons, so we never
 * wrap a link in a button (or vice versa) just to borrow a look.
 */
export type ButtonVariant = "primary" | "brand" | "outline" | "ghost" | "panel";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ink-foreground hover:bg-ink/90",
  brand: "bg-brand text-brand-foreground hover:bg-brand-ink dark:hover:bg-brand/90",
  outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  panel: "bg-panel-foreground text-panel hover:bg-panel-foreground/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "size-11",
};

export function buttonClass(
  { variant = "primary", size = "md" }: { variant?: ButtonVariant; size?: ButtonSize } = {},
  className?: string,
) {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap",
    "transition-[background-color,color,transform,box-shadow] duration-(--duration-fast) ease-out-soft",
    "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}
