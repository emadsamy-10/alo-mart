"use client";

import { BadgeCheck, Heart, LayoutDashboard, LogOut, MapPin, Package, PenTool, ShieldCheck, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useFormStatus } from "react-dom";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { logoutAction } from "../actions";

export const ACCOUNT_LINKS = [
  { href: "/account", key: "overview", icon: LayoutDashboard },
  { href: "/account/orders", key: "orders", icon: Package },
  { href: "/account/addresses", key: "addresses", icon: MapPin },
  { href: "/account/profile", key: "profile", icon: UserRound },
  { href: "/account/security", key: "security", icon: ShieldCheck },
  { href: "/account/subscription", key: "subscription", icon: BadgeCheck },
  { href: "/account/inspiration", key: "inspiration", icon: Heart },
  { href: "/account/designer", key: "designer", icon: PenTool },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Account sections: a sidebar on desktop, a horizontally scrolling tab row on mobile. */
export function AccountNav() {
  const t = useTranslations("Account.nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} data-scroll-strip className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-2 lg:flex-col lg:gap-1">
        {ACCOUNT_LINKS.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-full px-4 text-sm font-semibold transition-colors lg:rounded-2xl",
                  active ? "bg-ink text-ink-foreground" : "bg-surface text-foreground hover:bg-surface-muted lg:bg-transparent",
                )}
              >
                <Icon className="size-4.5 shrink-0" aria-hidden />
                {t(key)}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 lg:mt-3 lg:border-t lg:border-border lg:pt-3">
          <SignOutButton className="lg:w-full" />
        </li>
      </ul>
    </nav>
  );
}

function SignOutSubmit({ className, label }: { className?: string; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid="sign-out"
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted disabled:opacity-60 lg:rounded-2xl",
        className,
      )}
    >
      <LogOut className="size-4.5 shrink-0 text-brand-text" aria-hidden />
      {label}
    </button>
  );
}

/** Sign out = a POST (Server Action), never a GET link that a prefetch could trigger. */
export function SignOutButton({ className }: { className?: string }) {
  const t = useTranslations("Account.nav");
  return (
    <form action={logoutAction}>
      <SignOutSubmit className={className} label={t("signOut")} />
    </form>
  );
}
