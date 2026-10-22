import { Container } from "@/components/shared/Container";
import type { MarketOption } from "@/features/markets/types";
import { HeaderShopButtons } from "@/features/cart/HeaderShopButtons";
import { DepartmentsMenu } from "./DepartmentsMenu";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MarketSwitcher } from "./MarketSwitcher";
import { MobileMenu } from "./MobileMenu";
import { PrimaryNav } from "./PrimaryNav";
import { StickyHeader } from "./StickyHeader";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { NavCategory } from "./nav-types";

interface SiteHeaderProps {
  departments: NavCategory[];
  markets: MarketOption[];
  market: string;
}

/**
 * Slim desktop preferences strip (36px): market/currency at the start,
 * language and theme at the end. Scrolls away; the navigation stays.
 */
export function UtilityBar({ markets, market }: Omit<SiteHeaderProps, "departments">) {
  return (
    <div className="hidden bg-utility lg:block">
      <Container className="flex h-9 items-center justify-between gap-4">
        <MarketSwitcher markets={markets} current={market} trigger="utility" align="start" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <span className="mx-1 h-3.5 w-px bg-border-strong" aria-hidden />
          <ThemeSwitcher />
        </div>
      </Container>
    </div>
  );
}

/**
 * Floating navigation header.
 *
 * Desktop (≥1024px): a three-column grid — logo at the start, the rounded
 * navigation capsule at the exact center, the red "All departments" pill at
 * the end (logical order, so RTL mirrors naturally). The capsule shows as
 * many departments as fit; the rest live in the mega menu. Sticky, with a
 * soft shadow once content scrolls under it.
 *
 * Mobile/tablet (<1024px): menu · centered logo · market pill · cart.
 */
export function SiteHeader({ departments, markets, market }: SiteHeaderProps) {
  return (
    <StickyHeader>
      <Container className="grid h-[4.25rem] grid-cols-[auto_1fr_auto] items-center gap-3 lg:hidden">
        <MobileMenu departments={departments} />
        <Logo className="justify-self-center" />
        <div className="flex items-center gap-2">
          <MarketSwitcher markets={markets} current={market} trigger="pill" />
          <HeaderShopButtons showWishlist={false} />
        </div>
      </Container>

      <Container className="hidden h-[5.25rem] grid-cols-[1fr_auto_1fr] items-center gap-6 lg:grid">
        <Logo className="justify-self-start" />
        <PrimaryNav departments={departments} />
        <div className="flex items-center gap-2 justify-self-end">
          <HeaderShopButtons />
          {departments.length ? <DepartmentsMenu departments={departments} /> : null}
        </div>
      </Container>
    </StickyHeader>
  );
}
