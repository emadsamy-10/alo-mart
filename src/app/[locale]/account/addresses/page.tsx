import type { Metadata } from "next";
import { MapPin, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { getAddresses, requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { DeleteAddress, SetDefaultAddress } from "@/features/account/ui/AddressActions";
import { AccountHeading } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/addresses">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/addresses", "addresses");
}

const SAVED = new Set(["created", "updated", "deleted", "default"]);

export default async function Page({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/addresses");
  if (!customer) return <AccountUnavailable retryHref="/account/addresses" />;
  const [t, query, addresses] = await Promise.all([getTranslations("Account"), searchParams, getAddresses(locale)]);
  if (!addresses.ok) return <AccountUnavailable retryHref="/account/addresses" />;
  const saved = typeof query.saved === "string" && SAVED.has(query.saved) ? (query.saved as "created" | "updated" | "deleted" | "default") : null;
  const sep = locale === "ar" ? "، " : ", ";

  const addButton = (
    <Link href="/account/addresses/new" className={buttonClass({ variant: "brand" })}>
      <Plus className="size-4.5" aria-hidden />
      {t("addresses.add")}
    </Link>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <AccountHeading title={t("titles.addresses")} intro={t("addresses.intro")} />
        {addresses.data.length ? <div className="mb-6">{addButton}</div> : null}
      </div>
      {saved ? <Notice>{t(`addresses.saved.${saved}`)}</Notice> : null}

      {addresses.data.length === 0 ? (
        <StatusPanel icon={<MapPin className="size-6" />} title={t("addresses.emptyTitle")} body={t("addresses.emptyBody")} action={addButton} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="addresses">
          {addresses.data.map((a) => {
            const label = a.label || a.recipient_name;
            return (
              <li key={a.id} className="flex flex-col rounded-panel border border-border bg-surface p-5 shadow-card" data-testid="address-card">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold">{label}</h2>
                  {a.is_default ? <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-text">{t("addresses.default")}</span> : null}
                </div>
                <address className="flex-1 space-y-0.5 text-sm leading-relaxed text-muted-foreground not-italic">
                  <p className="font-semibold text-foreground">{a.recipient_name}</p>
                  <p>{[a.address_line_1, a.address_line_2].filter(Boolean).join(sep)}</p>
                  <p>{[a.building && t("addresses.buildingShort", { value: a.building }), a.floor && t("addresses.floorShort", { value: a.floor }), a.unit && t("addresses.unitShort", { value: a.unit })].filter(Boolean).join(sep)}</p>
                  <p>{[a.city?.name, a.region?.name, a.country?.name].filter(Boolean).join(sep)}</p>
                  <p>
                    <span dir="ltr">{a.recipient_phone}</span>
                  </p>
                </address>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Link href={`/account/addresses/${a.id}/edit`} className={buttonClass({ variant: "outline", size: "sm" }, "h-10 px-4")}>
                    <span aria-hidden>{t("addresses.edit")}</span>
                    <span className="sr-only">{t("addresses.editNamed", { label })}</span>
                  </Link>
                  {a.is_default ? null : <SetDefaultAddress id={a.id} label={label} />}
                  <DeleteAddress id={a.id} label={label} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
