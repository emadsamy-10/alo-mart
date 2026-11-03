import type { Metadata } from "next";
import { Package } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Pagination } from "@/components/shared/Pagination";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { getOrders, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading } from "@/features/account/ui/AccountSection";
import { OrderStatus } from "@/features/account/ui/OrderStatus";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { Link } from "@/lib/i18n/navigation";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/orders">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/orders", "orders");
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const page = typeof query.page === "string" && /^\d{1,5}$/.test(query.page) ? Math.max(1, Number(query.page)) : 1;
  const path = page > 1 ? `/account/orders?page=${page}` : "/account/orders";
  const customer = await requireCustomer(locale, path);
  if (!customer) return <AccountUnavailable retryHref={path} />;
  const [t, orders] = await Promise.all([getTranslations("Account"), getOrders(locale, page)]);
  if (!orders.ok) return <AccountUnavailable retryHref={path} />;
  const { items, meta } = orders.data;

  return (
    <div className="space-y-6">
      <AccountHeading title={t("titles.orders")} intro={meta.total ? t("orders.intro", { count: meta.total }) : undefined} />
      {items.length === 0 ? (
        <StatusPanel
          icon={<Package className="size-6" />}
          title={page > 1 ? t("orders.pageEmpty") : t("orders.empty")}
          body={page > 1 ? undefined : t("orders.emptyBody")}
          action={
            <Link href={page > 1 ? "/account/orders" : "/products"} className={buttonClass({ variant: "brand" })}>
              {page > 1 ? t("orders.firstPage") : t("orders.startShopping")}
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3" data-testid="orders">
            {items.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${order.id}`}
                  className="grid grid-cols-1 gap-3 rounded-panel border border-border bg-surface p-5 shadow-card transition hover:border-border-strong sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-bold tabular-nums" dir="ltr">
                        #{order.order_number}
                      </span>
                      <OrderStatus status={order.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t("orders.placedOn", { date: formatDate(order.placed_at, locale) })} · {t("orders.items", { count: order.quantity_count ?? order.item_count })}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="text-lg font-bold tabular-nums">{formatMoney(order.totals.grand_total, order.currency, locale)}</span>
                    <span className="text-sm font-semibold text-brand-text">{t("orders.view")}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {meta.last_page > 1 ? <Pagination path="/account/orders" page={meta.current_page} lastPage={meta.last_page} /> : null}
        </>
      )}
    </div>
  );
}
