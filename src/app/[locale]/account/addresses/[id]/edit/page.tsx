import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getAddress, getCities, getCountries, getRegions, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { AddressForm } from "@/features/account/ui/AddressForm";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/addresses/[id]/edit">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  return accountMetadata(locale, `/account/addresses/${id}/edit`, "editAddress");
}

export default async function Page({ params }: Props) {
  const { locale, id: rawId } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  const id = /^\d{1,12}$/.test(rawId) ? Number(rawId) : null;
  if (!id) notFound();
  const path = `/account/addresses/${id}/edit`;
  const customer = await requireCustomer(locale, path);
  if (!customer) return <AccountUnavailable retryHref={path} />;

  const [t, countries, address] = await Promise.all([getTranslations("Account"), getCountries(locale), getAddress(locale, id)]);
  // Another customer's address is "not found" for the API — same here.
  if (!address.ok && address.error.kind === "not_found") notFound();
  if (!address.ok || !countries.ok) return <AccountUnavailable retryHref={path} />;
  const [regions, cities] = await Promise.all([
    address.data.country ? getRegions(locale, address.data.country.id) : null,
    address.data.region ? getCities(locale, address.data.region.id) : null,
  ]);

  return (
    <div className="space-y-6">
      <AccountHeading title={t("titles.editAddress")} />
      <AccountSection title={t("addresses.details")}>
        <AddressForm
          countries={countries.data}
          address={address.data}
          regions={regions?.ok ? regions.data : []}
          cities={cities?.ok ? cities.data : []}
          defaults={{ name: customer.name, phone: customer.phone }}
          first={false}
        />
      </AccountSection>
    </div>
  );
}
