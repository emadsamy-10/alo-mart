import type { Metadata } from "next";
import { ChevronRight, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { getAddresses, getOrders, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { OrderStatus } from "@/features/account/ui/OrderStatus";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { ResendVerificationForm } from "@/features/account/ui/VerifyEmail";
import { Link } from "@/lib/i18n/navigation";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account", "overview");
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account");
  if (!customer) return <AccountUnavailable retryHref="/account" />;

  const [t, query, orders, addresses] = await Promise.all([getTranslations("Account"), searchParams, getOrders(locale, 1), getAddresses(locale)]);
  const defaultAddress = addresses.ok ? addresses.data.find((a) => a.is_default) : undefined;
  const recent = orders.ok ? orders.data.items.slice(0, 3) : [];

  const tiles = [
    { href: "/account/orders", icon: Package, title: t("nav.orders"), body: orders.ok ? t("overview.ordersCount", { count: orders.data.meta.total }) : t("overview.unavailable") },
    {
      href: "/account/addresses",
      icon: MapPin,
      title: t("nav.addresses"),
      body: addresses.ok ? (defaultAddress ? [defaultAddress.city?.name, defaultAddress.region?.name].filter(Boolean).join(locale === "ar" ? "، " : ", ") || defaultAddress.address_line_1 : t("overview.noAddress")) : t("overview.unavailable"),
    },
    { href: "/account/profile", icon: UserRound, title: t("nav.profile"), body: customer.email },
    { href: "/account/security", icon: ShieldCheck, title: t("nav.security"), body: customer.email_verified_at ? t("overview.verified") : t("overview.unverified") },
  ];

  return (
    <div className="space-y-6">
      <AccountHeading title={t("overview.greeting", { name: customer.name.split(/\s+/)[0] ?? customer.name })} intro={t("overview.intro")} />

      {query.welcome === "1" ? <Notice>{t("overview.welcome", { email: customer.email })}</Notice> : null}

      {!customer.email_verified_at ? (
        <div className="flex flex-col gap-4 rounded-panel border border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-center sm:justify-between" data-testid="verify-banner">
          <div>
            <p className="font-semibold">{t("overview.verifyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("overview.verifyBody", { email: customer.email })}</p>
          </div>
          <ResendVerificationForm compact />
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map(({ href, icon: Icon, title, body }) => (
          <li key={href}>
            <Link href={href} className="group flex h-full items-center gap-4 rounded-panel border border-border bg-surface p-5 shadow-card transition hover:border-border-strong">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-text" aria-hidden>
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{title}</span>
                <span className="block truncate text-sm text-muted-foreground">{body}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      <AccountSection
        title={t("overview.recentOrders")}
        action={
          recent.length ? (
            <Link href="/account/orders" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text hover:underline">
              {t("overview.allOrders")}
            </Link>
          ) : null
        }
      >
        {!orders.ok ? (
          <p className="text-sm text-danger">{t("overview.unavailable")}</p>
        ) : recent.length === 0 ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">{t("orders.empty")}</p>
            <Link href="/products" className={buttonClass({ variant: "brand" })}>
              {t("orders.startShopping")}
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((order) => (
              <li key={order.id}>
                <Link href={`/account/orders/${order.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5 hover:text-brand-text">
                  <span className="font-semibold tabular-nums" dir="ltr">
                    #{order.order_number}
                  </span>
                  <span className="text-sm text-muted-foreground">{formatDate(order.placed_at, locale)}</span>
                  <OrderStatus status={order.status} />
                  <span className="ms-auto font-semibold tabular-nums">{formatMoney(order.totals.grand_total, order.currency, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </AccountSection>
    </div>
  );
}
