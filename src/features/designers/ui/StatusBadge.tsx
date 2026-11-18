import { cn } from "@/lib/utils/cn";

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

const TONES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-foreground ring-success/30",
  warning: "bg-warning-soft text-foreground ring-warning/30",
  danger: "bg-danger-soft text-foreground ring-danger/30",
  neutral: "bg-surface-muted text-foreground ring-border",
  info: "bg-surface-muted text-foreground ring-border-strong",
};

/** Text-first status pill (the word carries the meaning; colour only reinforces it). */
export function StatusBadge({ tone, children, className }: { tone: BadgeTone; children: string; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1", TONES[tone], className)}>{children}</span>;
}

export function designTone(status: string): BadgeTone {
  return status === "published" ? "success" : status === "pending_review" ? "warning" : status === "rejected" ? "danger" : "neutral";
}

export function profileTone(status: string): BadgeTone {
  return status === "approved" ? "success" : status === "pending" ? "warning" : "danger";
}
