import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAddresses, getCountries, getRegions, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { AddressForm } from "@/features/account/ui/AddressForm";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { safeNext } from "@/features/account/redirect";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/addresses/new">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/addresses/new", "newAddress");
}

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const next = typeof query.next === "string" ? safeNext(query.next, "") || undefined : undefined;
  const customer = await requireCustomer(locale, next ? `/account/addresses/new?next=${encodeURIComponent(next)}` : "/account/addresses/new");
  if (!customer) return <AccountUnavailable retryHref="/account/addresses/new" />;
  const [t, countries, addresses] = await Promise.all([getTranslations("Account"), getCountries(locale), getAddresses(locale)]);
  if (!countries.ok) return <AccountUnavailable retryHref="/account/addresses/new" />;
  // A single active country is preselected, so its regions are needed straight away.
  const regions = countries.data.length === 1 ? await getRegions(locale, countries.data[0].id) : null;

  return (
    <div className="space-y-6">
      <AccountHeading title={t("titles.newAddress")} />
      <AccountSection title={t("addresses.details")}>
        <AddressForm
          countries={countries.data}
          regions={regions?.ok ? regions.data : []}
          defaults={{ name: customer.name, phone: customer.phone }}
          first={addresses.ok && addresses.data.length === 0}
          next={next}
        />
      </AccountSection>
    </div>
  );
}
