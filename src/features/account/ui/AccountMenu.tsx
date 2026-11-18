"use client";

import { UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { DropdownMenu } from "radix-ui";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { loginHref } from "../redirect";
import { ACCOUNT_LINKS, SignOutButton } from "./AccountNav";

const trigger =
  "relative flex h-11 shrink-0 items-center gap-2 rounded-full px-2.5 text-start text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-muted data-[state=open]:bg-surface-muted";

/** Two quiet lines beside the icon; below 1280px the icon stands alone. */
function Lines({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="hidden flex-col leading-tight xl:flex">
      <span className="text-[0.8125rem] font-bold whitespace-nowrap">{top}</span>
      <span className="text-xs whitespace-nowrap text-muted-foreground">{bottom}</span>
    </span>
  );
}

export interface HeaderAccount {
  firstName: string;
  verified: boolean;
}

/**
 * Header account entry, next to wishlist and cart (same round button).
 * Guest: a link to sign in that returns to the current page.
 * Signed in: a menu with the account sections and sign-out.
 */
export function AccountMenu({ account, className }: { account: HeaderAccount | null; className?: string }) {
  const t = useTranslations("Account.nav");
  const pathname = usePathname();
  const router = useRouter();

  if (!account) {
    const onAuthPage = /^\/(login|register|forgot-password|reset-password|verify-email)/.test(pathname);
    return (
      <Link
        href={onAuthPage ? "/login" : loginHref(pathname)}
        // Return to the exact page, query included (e.g. a product's ?variant=).
        onClick={(event) => {
          if (onAuthPage || !window.location.search || event.metaKey || event.ctrlKey || event.shiftKey) return;
          event.preventDefault();
          router.push(loginHref(pathname + window.location.search));
        }}
        title={t("signIn")}
        className={cn(trigger, className)}
        data-testid="header-sign-in"
      >
        <UserRound className="size-6 shrink-0" aria-hidden />
        <Lines top={t("guestGreeting")} bottom={t("guestRegister")} />
      </Link>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className={cn(trigger, className)} data-testid="account-menu">
        <span className="relative shrink-0">
          <UserRound className="size-6" aria-hidden />
          <span className="absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full bg-success ring-2 ring-surface" aria-hidden />
        </span>
        <Lines top={t("hello", { name: account.firstName })} bottom={t("myAccount")} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-60 rounded-3xl border border-border bg-surface p-2 shadow-popover">
          <DropdownMenu.Label className="px-3 pt-2 pb-2.5 text-sm">
            <span className="block font-bold">{t("hello", { name: account.firstName })}</span>
            {account.verified ? null : <span className="mt-0.5 block text-xs text-warning">{t("verifyPending")}</span>}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="mx-2 mb-1 h-px bg-border" />
          {ACCOUNT_LINKS.map(({ href, key, icon: Icon }) => (
            <DropdownMenu.Item key={href} asChild>
              <Link href={href} className="flex min-h-11 items-center gap-2.5 rounded-2xl px-3 text-sm font-semibold outline-none data-highlighted:bg-surface-muted">
                <Icon className="size-4.5 text-muted-foreground" aria-hidden />
                {t(key)}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="mx-2 my-1 h-px bg-border" />
          {/* A real form inside the menu: keyboard users reach it with Tab. */}
          <SignOutButton className="w-full rounded-2xl" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
