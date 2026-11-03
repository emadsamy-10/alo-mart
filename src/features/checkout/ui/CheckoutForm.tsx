"use client";

import { AlertCircle, Loader2, Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { IDLE } from "@/features/account/form-state";
import type { Address } from "@/features/account/schemas";
import { FormAlert, SubmitButton } from "@/features/account/ui/fields";
import { Link } from "@/lib/i18n/navigation";
import { formatMoney } from "@/lib/i18n/format";
import { cn } from "@/lib/utils/cn";
import { placeOrderAction, requoteAction } from "../actions";
import { allBlockers, defaultSelections, type ShippingSelections } from "../model";
import type { PaymentMethod, Quote } from "../schemas";
import { VerifyEmailNotice } from "./VerifyEmailNotice";

interface CheckoutFormProps {
  addresses: Address[];
  initialAddressId: number;
  initialQuote: Quote;
  initialSelections: ShippingSelections;
  methods: PaymentMethod[];
  idempotencyKey: string;
  /** The customer's email is unverified: the backend will refuse a new order until it is. */
  emailUnverified?: boolean;
}

const card = "rounded-panel border border-border bg-surface p-5 shadow-card sm:p-7";
const choice =
  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors has-[:checked]:border-brand has-[:checked]:bg-brand-soft/40 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2";

/**
 * One-page checkout. Address and shipping changes are re-quoted by the API
 * (totals are never computed here); "Place order" is enabled only when the
 * latest quote says the order is ready and a payment method is chosen.
 */
export function CheckoutForm({ addresses, initialAddressId, initialQuote, initialSelections, methods, idempotencyKey, emailUnverified = false }: CheckoutFormProps) {
  const t = useTranslations("Checkout");
  const locale = useLocale();
  const [addressId, setAddressId] = useState(initialAddressId);
  const [selections, setSelections] = useState(initialSelections);
  const [quote, setQuote] = useState(initialQuote);
  const [method, setMethod] = useState(methods.length === 1 ? methods[0].code : "");
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, startQuote] = useTransition();
  const [state, action] = useActionState(placeOrderAction, IDLE);

  const money = (value: string | null) => formatMoney(value, quote.currency, locale) ?? "—";
  const sep = locale === "ar" ? "، " : ", ";

  const requote = (nextAddress: number, nextSelections: ShippingSelections) => {
    startQuote(async () => {
      const result = await requoteAction(nextAddress, nextSelections);
      if (!result.ok) {
        setQuoteError(result.message);
        return;
      }
      setQuoteError(null);
      const reconciled = defaultSelections(result.quote, nextSelections);
      // New options (another address) → quote once more with the reconciled choice.
      if (JSON.stringify(reconciled) !== JSON.stringify(nextSelections)) {
        const again = await requoteAction(nextAddress, reconciled);
        setSelections(reconciled);
        if (again.ok) setQuote(again.quote);
        else setQuoteError(again.message);
        return;
      }
      setSelections(nextSelections);
      setQuote(result.quote);
    });
  };

  const blockers = allBlockers(quote);
  const canPlace = quote.checkout_ready && !!method && !quoting && !quoteError;

  return (
    <>
    {/* Up front when the account is unverified, and after a refusal at submit (the state changed meanwhile). Outside the form: it holds its own. */}
    {emailUnverified || (state.status === "error" && state.code === "email_unverified") ? <VerifyEmailNotice /> : null}
    <form action={action} className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start" data-testid="checkout-form">
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <input type="hidden" name="address_id" value={addressId} />
      {Object.entries(selections).map(([store, shippingMethod]) => (
        <input key={store} type="hidden" name={`shipping[${store}]`} value={shippingMethod} />
      ))}

      <div className="min-w-0 space-y-6">
        {/* 1 · Delivery address */}
        <fieldset className={card} disabled={quoting}>
          <legend className="sr-only">{t("addressTitle")}</legend>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold sm:text-xl" aria-hidden>
              <span className="text-brand-text">1.</span> {t("addressTitle")}
            </h2>
            <Link href="/account/addresses/new?next=%2Fcheckout" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-text hover:underline">
              {t("addAddress")}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="checkout-addresses">
            {addresses.map((a) => (
              <label key={a.id} className={cn(choice, "border-border")}>
                <input
                  type="radio"
                  name="address_choice"
                  value={a.id}
                  checked={addressId === a.id}
                  onChange={() => {
                    setAddressId(a.id);
                    requote(a.id, selections);
                  }}
                  className="mt-1 size-4 shrink-0 accent-brand"
                />
                <span className="min-w-0 text-sm leading-relaxed">
                  <span className="block font-semibold">
                    {a.label || a.recipient_name}
                    {a.is_default ? <span className="ms-2 rounded-full bg-brand-soft px-2 py-0.5 text-xs text-brand-text">{t("default")}</span> : null}
                  </span>
                  <span className="block text-muted-foreground">{[a.address_line_1, a.city?.name, a.region?.name].filter(Boolean).join(sep)}</span>
                  <span className="block text-muted-foreground">
                    {a.recipient_name} · <span dir="ltr">{a.recipient_phone}</span>
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* 2 · Items and delivery, per store (each store ships separately) */}
        <section className={card} aria-labelledby="checkout-delivery">
          <h2 id="checkout-delivery" className="mb-1 text-lg font-bold sm:text-xl">
            <span className="text-brand-text">2.</span> {t("deliveryTitle")}
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">{t("deliveryIntro")}</p>
          <div className="space-y-6">
            {quote.stores.map((store) => (
              <div key={store.store.id} className="rounded-2xl border border-border p-4" data-testid="checkout-store">
                <h3 className="font-bold">{t("soldBy", { store: store.store.name })}</h3>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {store.items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-medium">{item.product?.name}</span>
                        <span className="block text-muted-foreground">
                          {[item.variant?.options.map((o) => o.value?.name).filter(Boolean).join(" / "), t("qty", { count: item.quantity })].filter(Boolean).join(" · ")}
                        </span>
                        {item.blockers.map((b) => (
                          <span key={b.code} className="mt-1 block text-danger">
                            {b.message}
                          </span>
                        ))}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{money(item.line_subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <fieldset className="mt-3" disabled={quoting}>
                  <legend className="mb-2 text-sm font-semibold">{t("shippingMethod")}</legend>
                  {store.shipping_options.length === 0 ? (
                    <p className="flex items-start gap-2 text-sm text-danger">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {store.blockers[0]?.message ?? t("noShipping")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {store.shipping_options.map((option) => {
                        const days = option.delivery_estimate;
                        return (
                          <label key={option.shipping_method_id} className={cn(choice, "border-border")}>
                            <input
                              type="radio"
                              name={`shipping_choice_${store.store.id}`}
                              value={option.shipping_method_id}
                              checked={selections[store.store.id] === option.shipping_method_id}
                              onChange={() => requote(addressId, { ...selections, [store.store.id]: option.shipping_method_id })}
                              className="mt-1 size-4 shrink-0 accent-brand"
                            />
                            <span className="flex min-w-0 flex-1 flex-wrap justify-between gap-x-4 text-sm">
                              <span>
                                <span className="block font-semibold">{option.name}</span>
                                {days && days.min_days !== null && days.max_days !== null ? (
                                  <span className="block text-muted-foreground">{t("deliveryDays", { min: days.min_days, max: days.max_days })}</span>
                                ) : null}
                              </span>
                              <span className="font-semibold tabular-nums">{option.is_free_shipping ? t("free") : money(option.fee)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              </div>
            ))}
          </div>
        </section>

        {/* 3 · Payment */}
        <fieldset className={card} data-testid="checkout-payment">
          <legend className="sr-only">{t("paymentTitle")}</legend>
          <h2 className="mb-1 text-lg font-bold sm:text-xl" aria-hidden>
            <span className="text-brand-text">3.</span> {t("paymentTitle")}
          </h2>
          {methods.length === 0 ? (
            <p className="mt-3 flex items-start gap-2 text-sm text-danger" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("noPaymentMethods")}
            </p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{t("paymentIntro")}</p>
              <div className="space-y-2">
                {methods.map((m) => (
                  <label key={m.code} className={cn(choice, "border-border")}>
                    <input
                      type="radio"
                      name="payment_method"
                      value={m.code}
                      checked={method === m.code}
                      onChange={() => setMethod(m.code)}
                      className="mt-1 size-4 shrink-0 accent-brand"
                    />
                    <span className="text-sm font-semibold">{m.name}</span>
                  </label>
                ))}
              </div>
              {state.fieldErrors?.payment_method ? <p className="mt-2 text-sm text-danger">{state.fieldErrors.payment_method}</p> : null}
            </>
          )}
        </fieldset>
      </div>

      {/* Summary: server totals only */}
      <aside className={cn(card, "lg:sticky lg:top-28")} aria-labelledby="checkout-summary" aria-busy={quoting}>
        <h2 id="checkout-summary" className="mb-4 text-lg font-bold sm:text-xl">
          {t("summaryTitle")}
        </h2>
        <dl className="space-y-2 text-sm" data-testid="checkout-totals">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("items", { count: quote.quantity_count })}</dt>
            <dd className="tabular-nums">{money(quote.merchandise_total)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("shipping")}</dt>
            <dd className="tabular-nums">{quote.shipping_total === null ? t("chooseShipping") : money(quote.shipping_total)}</dd>
          </div>
          {quote.tax_calculated && quote.tax_total !== null ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {quote.tax?.price_includes_tax ? t("taxIncluded", { name: quote.tax?.name ?? t("tax") }) : (quote.tax?.name ?? t("tax"))}
              </dt>
              <dd className="tabular-nums">{money(quote.tax_total)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-extrabold">
            <dt>{t("total")}</dt>
            <dd className="text-brand-text tabular-nums" data-testid="checkout-total">
              {quote.grand_total === null ? "—" : money(quote.grand_total)}
            </dd>
          </div>
        </dl>

        <div aria-live="polite" className="mt-4 space-y-3 text-sm">
          {quoting ? (
            <p className="flex items-center gap-2 text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("updating")}
            </p>
          ) : null}
          {quoteError ? (
            <p className="flex items-start gap-2 text-danger" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {quoteError}
            </p>
          ) : null}
          {!quoting && quote.checkout_ready && !method && methods.length ? <p className="text-muted-foreground">{t("choosePayment")}</p> : null}
          {!quoting && blockers.length ? (
            <ul className="space-y-1 text-danger" data-testid="checkout-blockers">
              {blockers.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <FormAlert state={state} className="mt-4" />
        <div className="mt-5">
          {canPlace ? (
            <SubmitButton pendingLabel={t("placing")} className="w-full sm:w-full">
              <Lock className="size-4" aria-hidden />
              {t("placeOrder")}
            </SubmitButton>
          ) : (
            <button type="button" disabled className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-brand-foreground opacity-50">
              <Lock className="size-4" aria-hidden />
              {t("placeOrder")}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("placeNote")}</p>
      </aside>
    </form>
    </>
  );
}
