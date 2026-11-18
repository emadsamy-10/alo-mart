import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading, AccountSection } from "@/features/account/ui/AccountSection";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { getDesignCategories, getStudio } from "@/features/designers/api";
import { DesignForm } from "@/features/designers/ui/DesignEditor";
import { StudioNav } from "@/features/designers/ui/StudioNav";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/designer/designs/new">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/designer/designs/new", "newDesign");
}

export default async function NewDesignPage({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/designer/designs/new");
  if (!customer) return <AccountUnavailable retryHref="/account/designer/designs/new" />;
  const [studio, categories] = await Promise.all([getStudio(locale, "/account/designer/designs/new"), getDesignCategories(locale)]);
  if (!studio.ok || !categories.ok) return <AccountUnavailable retryHref="/account/designer/designs/new" />;
  if (!studio.data.profile) redirect({ href: "/account/designer", locale });
  const t = await getTranslations("Designers.studio");

  return (
    <div className="space-y-6">
      <AccountHeading title={t("newDesign")} intro={t("designsIntro")} />
      <StudioNav current="designs" />
      <AccountSection title={t("newDesign")}>
        <DesignForm design={null} categories={categories.data} />
      </AccountSection>
    </div>
  );
}
