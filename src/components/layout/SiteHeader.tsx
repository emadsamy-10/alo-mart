import { Headset, PackageSearch, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/shared/Container";
import type { MarketOption } from "@/features/markets/types";
import { AccountMenu, type HeaderAccount } from "@/features/account/ui/AccountMenu";
import { HeaderShopButtons } from "@/features/cart/HeaderShopButtons";
import { Link } from "@/lib/i18n/navigation";
import { HeaderSearch, HeaderSearchForm } from "./HeaderSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";
import { MainNav } from "./MainNav";
import { MarketSwitcher } from "./MarketSwitcher";
import { MobileMenu } from "./MobileMenu";
import { StickyHeader } from "./StickyHeader";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { NavCategory } from "./nav-types";

interface SiteHeaderProps {
  departments: NavCategory[];
  markets: MarketOption[];
  market: string;
  /** The signed-in customer (null = guest). */
  account?: HeaderAccount | null;
}

const NAV_CONTAINER = "mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-8";

/**
 * Thin navy strip (desktop). Facts only: delivery is decided per address at
 * checkout, so no coverage is promised; support appears when the platform
 * publishes an address. Scrolls away with the page.
 */
export function UtilityBar({ markets, market, supportEmail }: Omit<SiteHeaderProps, "departments" | "account"> & { supportEmail: string | null }) {
  const t = useTranslations("Header");
  const item = "inline-flex h-8 items-center gap-1.5 text-[0.8125rem] font-medium text-utility-foreground transition-colors hover:text-white";

  return (
    <section aria-label={t("preferences")} className="hidden bg-utility text-utility-foreground lg:block" data-testid="utility-bar">
      <Container className="flex h-9 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-5">
          <p className={item}>
            <Truck className="size-4 shrink-0 text-utility-muted" aria-hidden />
            <span className="truncate">{t("deliveryNote")}</span>
          </p>
          <span className="h-3.5 w-px bg-white/20" aria-hidden />
          <Link href="/account/orders" className={item}>
            <PackageSearch className="size-4 text-utility-muted" aria-hidden />
            {t("myOrders")}
          </Link>
          {supportEmail ? (
            <a href={`mailto:${supportEmail}`} className={item} data-testid="utility-support">
              <Headset className="size-4 text-utility-muted" aria-hidden />
              {t("support")}
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <MarketSwitcher markets={markets} current={market} trigger="utility" align="end" />
          <span className="mx-1 h-3.5 w-px bg-white/20" aria-hidden />
          <LanguageSwitcher />
          <span className="mx-1 h-3.5 w-px bg-white/20" aria-hidden />
          <ThemeSwitcher />
        </div>
      </Container>
    </section>
  );
}

/**
 * One responsive header (a single search form and cart in the first row).
 *
 * Desktop: logo · large central search · account, wishlist, cart; below it the
 * navigation row, which stays pinned (with a compact logo, search and cart)
 * after the first row has scrolled away.
 *
 * Phones and tablets: menu · logo · market, cart; below it the search row, which
 * stays pinned. Sections live in the drawer and the bottom navigation.
 */
export function SiteHeader({ departments, markets, market, account = null }: SiteHeaderProps) {
  return (
    <StickyHeader>
      <Container className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 [grid-template-areas:'menu_logo_actions''search_search_search'] lg:h-[5.5rem] lg:grid-cols-[minmax(11rem,1fr)_minmax(0,2.5fr)_minmax(11rem,1fr)] lg:gap-x-8 lg:[grid-template-areas:'logo_search_actions'] xl:gap-x-12">
        <div className="flex h-[3.75rem] items-center [grid-area:menu] lg:hidden">
          <MobileMenu departments={departments} account={account} />
        </div>
        <div className="flex h-[3.75rem] items-center justify-center [grid-area:logo] lg:h-auto lg:justify-start">
          <Logo />
        </div>
        <HeaderSearchForm className="mx-auto h-[3.75rem] w-full max-w-2xl [grid-area:search] max-lg:max-w-none lg:h-auto" />
        <div className="-me-2 flex h-[3.75rem] items-center justify-end gap-1 [grid-area:actions] lg:-me-2.5 lg:h-auto">
          <div className="lg:hidden">
            <MarketSwitcher markets={markets} current={market} trigger="pill" />
          </div>
          <div className="hidden lg:block">
            <AccountMenu account={account} />
          </div>
          <HeaderShopButtons wishlistClassName="max-lg:hidden" />
        </div>
      </Container>

      <div className="hidden border-t border-border/70 lg:block">
        <MainNav
          departments={departments}
          containerClassName={NAV_CONTAINER}
          compactStart={<Logo compact className="me-2" />}
          compactEnd={
            <>
              <HeaderSearch />
              <HeaderShopButtons showWishlist={false} />
            </>
          }
        />
      </div>
    </StickyHeader>
  );
}
