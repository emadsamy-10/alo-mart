import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { getInspiration } from "@/features/designers/api";
import { DesignCard, DesignerCard } from "@/features/designers/ui/Cards";
import { InspirationToggle } from "@/features/designers/ui/InspirationToggle";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/inspiration">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/inspiration", "inspiration");
}

/** Customer Plus "My Inspiration": followed designers and saved designs (separate from the product wishlist). */
export default async function InspirationPage({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/inspiration");
  if (!customer) return <AccountUnavailable retryHref="/account/inspiration" />;
  const result = await getInspiration(locale);
  if (!result.ok) return <AccountUnavailable retryHref="/account/inspiration" />;
  const t = await getTranslations("Designers");
  const ts = await getTranslations("Account.titles");
  const data = result.data;
  const hidden = data.hidden.designers + data.hidden.designs;

  return (
    <div className="space-y-6">
      <AccountHeading title={ts("inspiration")} intro={t("inspiration.intro")} />
      {!data.entitled ? (
        <Notice tone="info">
          {t("inspiration.notEntitled")}{" "}
          <Link href="/subscriptions?for=customers" className="font-semibold text-brand-text hover:underline">
            {t("follow.seePlans")}
          </Link>
        </Notice>
      ) : null}
      {hidden > 0 ? <p className="text-sm text-muted-foreground">{t("inspiration.hidden", { count: hidden })}</p> : null}

      <AccountSection title={t("inspiration.designers")}>
        {data.designers.length ? (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3" data-testid="followed-designers">
            {data.designers.map((d) => (
              <li key={d.slug} className="space-y-2">
                <DesignerCard designer={d} />
                <InspirationToggle kind="designer" slug={d.slug} name={d.display_name} active signedIn back="/account/inspiration" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("inspiration.emptyDesigners")}</p>
        )}
      </AccountSection>

      <AccountSection title={t("inspiration.designs")}>
        {data.designs.length ? (
          <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3" data-testid="saved-designs">
            {data.designs.map((d) => (
              <li key={d.slug} className="space-y-2">
                <DesignCard design={d} />
                <InspirationToggle kind="design" slug={d.slug} name={d.title} active signedIn back="/account/inspiration" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("inspiration.emptyDesigns")}</p>
            <Link href="/designers" className={buttonClass({ variant: "outline" })}>
              {t("inspiration.browse")}
            </Link>
          </div>
        )}
      </AccountSection>
    </div>
  );
}
