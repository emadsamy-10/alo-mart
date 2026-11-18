import type { Metadata } from "next";
import { Info, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { getCurrentUser } from "@/features/account/session";
import { getPlans, getStudio, getSubscriptionOverview } from "@/features/designers/api";
import { PlanCard, type RequestGate } from "@/features/designers/ui/PlanCard";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";
import { cn } from "@/lib/utils/cn";

type Props = PageProps<"/[locale]/subscriptions">;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Designers.plans" });
  return pageMetadata({ locale, path: "/subscriptions", title: t("title"), description: t("metaDescription"), noindex: Boolean(sp.for) });
}

/** Admin-configured Designer and Customer Plus plans. Requests only; no online payment exists yet. */
export default async function SubscriptionsPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;
  const audience = sp.for === "customers" ? "customer" : "designer";
  const [t, tc, plans, current] = await Promise.all([getTranslations("Designers"), getTranslations("Common"), getPlans(locale, audience), getCurrentUser(locale)]);
  if (!plans.ok) throw new CatalogUnavailableError(plans.error.kind);
  const back = `/subscriptions?for=${audience === "customer" ? "customers" : "designers"}`;

  let gate: RequestGate = { kind: "guest" };
  if (current.status === "signed_in") {
    const [overview, studio] = await Promise.all([getSubscriptionOverview(locale, back), audience === "designer" ? getStudio(locale, back) : Promise.resolve(null)]);
    const state = overview.ok ? overview.data[audience] : null;
    if (!current.user.email_verified_at) gate = { kind: "unverified" };
    else if (audience === "designer" && studio?.ok && !studio.data.profile) gate = { kind: "apply_first" };
    else if (state?.pending_request) gate = { kind: "pending" };
    else gate = { kind: "ready", renewal: Boolean(state?.entitled), activeUntil: state?.entitled ? (state.subscription?.ends_at ?? null) : null };
  }

  const tab = (key: "designers" | "customers") => ({ pathname: "/subscriptions", query: { for: key } });
  const active = audience === "customer" ? "customers" : "designers";

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("plans.title") }]} />
      <h1 className="tracking-display mt-4 text-3xl font-extrabold sm:text-4xl">{t("plans.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("plans.intro")}</p>

      <nav aria-label={t("plans.tabsLabel")} className="mt-6">
        <ul className="inline-flex rounded-full border border-border bg-surface p-1">
          {(["designers", "customers"] as const).map((key) => (
            <li key={key}>
              <Link
                href={tab(key)}
                aria-current={active === key ? "page" : undefined}
                className={cn("inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold", active === key ? "bg-ink text-ink-foreground" : "text-foreground hover:bg-surface-muted")}
                data-testid={`plans-tab-${key}`}
              >
                {key === "designers" ? t("plans.forDesigners") : t("plans.forCustomers")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <p className="mt-5 flex max-w-3xl items-start gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm" role="note">
        <Info className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        {t("plans.honest")}
      </p>

      {plans.data.length ? (
        <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((plan) => (
            <li key={plan.id}>
              <PlanCard plan={plan} gate={gate} back={back} />
            </li>
          ))}
        </ul>
      ) : (
        <StatusPanel className="mt-6" icon={<Sparkles className="size-6" />} title={t("plans.noPlansTitle")} body={t("plans.noPlansBody")} />
      )}

      {current.status === "signed_in" ? (
        <p className="mt-8">
          <Link href="/account/subscription" className="inline-flex min-h-11 items-center font-semibold text-brand-text hover:underline">
            {t("plans.manage")}
          </Link>
        </p>
      ) : null}
    </Container>
  );
}
