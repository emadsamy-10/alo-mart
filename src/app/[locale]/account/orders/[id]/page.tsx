import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { getOrder, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { orderView, type OrderNotice } from "@/features/account/order-view";
import { AccountSection } from "@/features/account/ui/AccountSection";
import { CancelOrder } from "@/features/account/ui/CancelOrder";
import { OrderStatus } from "@/features/account/ui/OrderStatus";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { Notice } from "@/features/account/ui/fields";
import { getPayment, getPaymentMethods } from "@/features/checkout/api";
import { newIdempotencyKey, paymentState } from "@/features/checkout/model";
import { CartResync } from "@/features/checkout/ui/CartResync";
import { PaymentPanel } from "@/features/checkout/ui/PaymentPanel";
import { Link } from "@/lib/i18n/navigation";
import { formatDateTime, formatMoney } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/orders/[id]">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  return accountMetadata(locale, `/account/orders/${id}`, "order");
}

export default async function Page({ params, searchParams }: Props) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const path = `/account/orders/${id}`;
  const customer = await requireCustomer(locale, path);
  if (!customer) return <AccountUnavailable retryHref={path} />;
  const [t, result] = await Promise.all([getTranslations("Account"), getOrder(locale, id)]);
  // Another customer's order is "not found" for the API — same here.
  if (!result.ok && result.error.kind === "not_found") notFound();
  if (!result.ok) return <AccountUnavailable retryHref={path} />;

  const order = result.data;
  const query = await searchParams;
  const placed = query.placed === "1";
  const view = orderView(order);
  // Payment record (404 = never started) and the methods to (re)start one, in the order's market —
  // only while the order can still be paid (never for a cancelled or expired order).
  const [payment, methods, tc] = await Promise.all([
    view.payable ? getPayment(locale, order.id) : null,
    view.payable ? getPaymentMethods(locale, order.market.code) : null,
    getTranslations("Checkout"),
  ]);
  const state = paymentState(order.payment_status, payment?.ok ? payment.data : null);
  const money = (value: string | null) => formatMoney(value, order.currency, locale) ?? "—";
  const a = order.delivery_address;
  const noticeText = (notice: OrderNotice) =>
    notice.kind === "cancelled" ? t(`orders.notices.cancelled.${notice.by}`)
    : notice.kind === "paymentExpired" ? t("orders.notices.paymentExpired")
    : notice.kind === "latePayment" ? t("orders.notices.latePayment")
    : t("orders.notices.refundReview");
  const sep = locale === "ar" ? "، " : ", ";

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ name: t("titles.orders"), href: "/account/orders" }, { name: `#${order.order_number}` }]} />
      {placed ? (
        <>
          <CartResync />
          <div data-testid="order-confirmation">
            <Notice>
              <span className="block font-semibold">{tc("confirmation.title")}</span>
              {tc("confirmation.body", { number: order.order_number })}
            </Notice>
          </div>
        </>
      ) : null}
      {query.payment === "failed" && view.payable ? <Notice tone="warning">{tc("confirmation.paymentNotStarted")}</Notice> : null}
      {query.cancelled === "1" && order.status === "cancelled" ? <Notice>{t("orders.cancel.done")}</Notice> : null}
      {view.notices.length > 0 ? (
        <div className="space-y-3" data-testid="order-notices">
          {view.notices.map((notice) => (
            <Notice key={notice.kind} tone={notice.kind === "cancelled" ? "info" : "warning"}>
              {noticeText(notice)}
            </Notice>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="tracking-display text-3xl font-extrabold tabular-nums sm:text-4xl" dir="ltr">
          #{order.order_number}
        </h1>
        <OrderStatus status={order.status} />
      </div>
      <p className="-mt-3 text-muted-foreground">
        {t("orders.placedOn", { date: formatDateTime(order.placed_at, locale) })} · <span data-testid="order-payment-status">{t(`orders.payment.${view.paymentLabel}`)}</span>
      </p>

      {view.payable || order.payment_status === "paid" ? (
        <AccountSection title={tc("payment.title")} id="payment">
          {view.payBy ? (
            <p className="mb-4 text-sm font-semibold" data-testid="order-pay-by">
              {t("orders.payBy", { date: formatDateTime(view.payBy, locale) })}
            </p>
          ) : null}
          {payment && !payment.ok && payment.error.kind !== "not_found" ? (
            <p className="text-sm text-danger" role="alert">
              {tc("payment.unavailable")}
            </p>
          ) : (
            <PaymentPanel orderId={order.id} state={state} methods={methods?.ok ? methods.data : []} idempotencyKey={newIdempotencyKey("pay")} />
          )}
          {view.canCancel ? (
            <div className="mt-5 border-t border-border pt-5">
              <CancelOrder orderId={order.id} orderNumber={order.order_number} />
            </div>
          ) : null}
        </AccountSection>
      ) : null}

      {order.stores.map((store) => (
        <AccountSection key={store.id} title={store.store.name} description={store.shipping?.name ?? undefined}>
          <div className="mb-2 flex flex-wrap items-center gap-2" data-testid="store-order-status">
            <OrderStatus status={store.status} />
            {store.refund ? (
              <span className="inline-flex h-7 items-center rounded-full bg-warning-soft px-3 text-xs font-semibold text-foreground">{t("orders.refund.pendingManualReview")}</span>
            ) : null}
          </div>
          <ul className="divide-y divide-border">
            {store.items.map((item) => {
              const options = item.variant.options.map((o) => o.value?.name).filter(Boolean).join(" / ");
              return (
                <li key={item.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 py-3.5">
                  <div className="min-w-0 flex-1">
                    {item.product.slug ? (
                      <Link href={`/products/${item.product.slug}${item.variant.id ? `?variant=${item.variant.id}` : ""}`} className="font-semibold hover:text-brand-text">
                        {item.product.name}
                      </Link>
                    ) : (
                      <p className="font-semibold">{item.product.name}</p>
                    )}
                    {options ? <p className="text-sm text-muted-foreground">{options}</p> : null}
                    <p className="text-sm text-muted-foreground">
                      {t("orders.qtyTimes", { quantity: item.quantity, price: money(item.unit_price) })}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{money(item.line_gross)}</span>
                </li>
              );
            })}
          </ul>
          {store.shipping ? (
            <p className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">{t("orders.shipping")}</span>
              <span className="font-semibold">{store.shipping.is_free_shipping ? t("orders.free") : money(store.shipping.fee)}</span>
            </p>
          ) : null}
        </AccountSection>
      ))}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AccountSection title={t("orders.deliverTo")}>
          {a ? (
            <address className="space-y-0.5 text-sm leading-relaxed not-italic">
              <p className="font-semibold">{a.recipient_name}</p>
              <p className="text-muted-foreground">{[a.address_line_1, a.address_line_2].filter(Boolean).join(sep)}</p>
              <p className="text-muted-foreground">{[a.city?.name, a.region?.name, a.country?.name].filter(Boolean).join(sep)}</p>
              <p className="text-muted-foreground">
                <span dir="ltr">{a.recipient_phone}</span>
              </p>
            </address>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </AccountSection>
        <AccountSection title={t("orders.summary")}>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("orders.merchandise")}</dt>
              <dd className="tabular-nums">{money(order.totals.merchandise_gross)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t("orders.shipping")}</dt>
              <dd className="tabular-nums">{money(order.totals.shipping_gross)}</dd>
            </div>
            {order.totals.tax_total && Number(order.totals.tax_total) > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t("orders.tax")}</dt>
                <dd className="tabular-nums">{money(order.totals.tax_total)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>{t("orders.total")}</dt>
              <dd className="tabular-nums">{money(order.totals.grand_total)}</dd>
            </div>
          </dl>
        </AccountSection>
      </div>
    </div>
  );
}
