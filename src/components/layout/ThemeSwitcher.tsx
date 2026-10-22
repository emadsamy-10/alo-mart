"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { DropdownMenu } from "radix-ui";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils/cn";

const OPTIONS = [
  { value: "light", icon: Sun, label: "themeLight" },
  { value: "dark", icon: Moon, label: "themeDark" },
  { value: "system", icon: Monitor, label: "themeSystem" },
] as const;

/** True only after hydration — the theme is unknown on the server. */
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeSwitcher({ variant = "menu" }: { variant?: "menu" | "segmented" }) {
  const t = useTranslations("Preferences");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const current = mounted ? (theme ?? "system") : null;

  if (variant === "segmented") {
    return (
      <div role="radiogroup" aria-label={t("theme")} className="inline-flex rounded-full bg-surface-muted p-1">
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={current === value}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              current === value ? "bg-surface text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {t(label)}
          </button>
        ))}
      </div>
    );
  }

  const TriggerIcon = !mounted ? Sun : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("changeTheme")}
        className="inline-flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface data-[state=open]:bg-surface"
      >
        <TriggerIcon className="size-4" aria-hidden />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-44 rounded-2xl border border-border bg-surface p-1.5 text-foreground shadow-popover"
        >
          <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
            {t("theme")}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={current ?? undefined} onValueChange={setTheme}>
            {OPTIONS.map(({ value, icon: Icon, label }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none select-none data-highlighted:bg-surface-muted data-[state=checked]:font-semibold"
              >
                <Icon className="size-4" aria-hidden />
                <span className="flex-1">{t(label)}</span>
                <DropdownMenu.ItemIndicator className="size-1.5 rounded-full bg-brand" />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
