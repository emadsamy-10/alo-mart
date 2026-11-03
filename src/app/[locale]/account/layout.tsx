import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Container } from "@/components/shared/Container";
import { AccountNav } from "@/features/account/ui/AccountNav";

/**
 * Account area shell. Each page checks the session itself (with its own
 * return path) — this layout only renders the section navigation.
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("Account");
  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <p className="text-sm font-semibold text-brand-text">{t("area")}</p>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
