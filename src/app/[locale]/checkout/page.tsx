import type { Metadata } from "next";
import { MapPin, ShoppingBag } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { Container } from "@/components/shared/Container";
import { buttonClass } from "@/components/ui/button";
import { getAddresses, requireCustomer } from "@/features/account/api";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { getPaymentMethods, getQuote } from "@/features/checkout/api";
import { defaultSelections, newIdempotencyKey } from "@/features/checkout/model";
import { CheckoutForm } from "@/features/checkout/ui/CheckoutForm";
import { VerifyEmailNotice } from "@/features/checkout/ui/VerifyEmailNotice";
import { resolveMarket } from "@/features/markets/api";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/checkout">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return pageMetadata({ locale, path: "/checkout", title: t("title"), description: t("title"), noindex: true });
}

/**
 * Checkout for the signed-in customer's cart in the current market. The
 * backend only checks out authenticated customers, so guests are sent to
 * sign-in (their device cart is merged into the account on the way back).
 */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/checkout");
  const t = await getTranslations("Checkout");
  if (!customer) {
    return (
      <Container className="py-10">
        <AccountUnavailable retryHref="/checkout" />
      </Container>
    );
  }

  const [market, addresses, query] = await Promise.all([resolveMarket(locale), getAddresses(locale), searchParams]);
  const heading = <h1 className="tracking-display mb-6 text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>;

  if (!addresses.ok) {
    return (
      <Container className="pt-6 pb-12 sm:pt-8">
        {heading}
        <AccountUnavailable retryHref="/checkout" />
      </Container>
    );
  }
  if (addresses.data.length === 0) {
    return (
      <Container className="pt-6 pb-12 sm:pt-8">
        {heading}
        {/* Say it now, not after they have entered an address: a new order needs a confirmed email. */}
        {customer.email_verified_at ? null : <VerifyEmailNotice />}
        <StatusPanel
          icon={<MapPin className="size-6" />}
          title={t("noAddressTitle")}
          body={t("noAddressBody")}
          action={
            <Link href="/account/addresses/new?next=%2Fcheckout" className={buttonClass({ variant: "brand" })}>
              {t("addAddress")}
            </Link>
          }
        />
      </Container>
    );
  }

  const wanted = typeof query.address === "string" ? Number(query.address) : NaN;
  const address = addresses.data.find((a) => a.id === wanted) ?? addresses.data.find((a) => a.is_default) ?? addresses.data[0];

  // Quote once to learn each store's shipping options, then with the default choice per store.
  let quote = await getQuote(locale, market.code, address.id);
  if (quote.ok && quote.data.item_count > 0) {
    const selections = defaultSelections(quote.data);
    if (Object.keys(selections).length) quote = await getQuote(locale, market.code, address.id, selections);
  }
  const methods = await getPaymentMethods(locale, market.code);

  if (!quote.ok || !methods.ok) {
    return (
      <Container className="pt-6 pb-12 sm:pt-8">
        {heading}
        <AccountUnavailable retryHref="/checkout" />
      </Container>
    );
  }
  if (quote.data.item_count === 0) {
    return (
      <Container className="pt-6 pb-12 sm:pt-8">
        {heading}
        <StatusPanel
          icon={<ShoppingBag className="size-6" />}
          title={t("emptyTitle")}
          body={t("emptyBody")}
          action={
            <Link href="/products" className={buttonClass({ variant: "brand" })}>
              {t("continueShopping")}
            </Link>
          }
        />
      </Container>
    );
  }

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      {heading}
      <CheckoutForm
        addresses={addresses.data}
        initialAddressId={address.id}
        initialQuote={quote.data}
        initialSelections={defaultSelections(quote.data)}
        methods={methods.data}
        idempotencyKey={newIdempotencyKey("order")}
        emailUnverified={!customer.email_verified_at}
      />
    </Container>
  );
}
