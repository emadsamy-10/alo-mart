import type { Metadata } from "next";
import { PenTool, Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { requireCustomer } from "@/features/account/api";
import { accountMetadata } from "@/features/account/metadata";
import { AccountHeading } from "@/features/account/ui/AccountSection";
import { Notice } from "@/features/account/ui/fields";
import { AccountUnavailable } from "@/features/account/ui/Unavailable";
import { getOwnDesigns, getStudio } from "@/features/designers/api";
import { designTone, StatusBadge } from "@/features/designers/ui/StatusBadge";
import { StudioNav } from "@/features/designers/ui/StudioNav";
import { formatDate } from "@/lib/i18n/format";
import { Link, redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

type Props = PageProps<"/[locale]/account/designer/designs">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  return accountMetadata(locale, "/account/designer/designs", "designs");
}

export default async function MyDesignsPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const customer = await requireCustomer(locale, "/account/designer/designs");
  if (!customer) return <AccountUnavailable retryHref="/account/designer/designs" />;
  const studio = await getStudio(locale, "/account/designer/designs");
  if (!studio.ok) return <AccountUnavailable retryHref="/account/designer/designs" />;
  if (!studio.data.profile) redirect({ href: "/account/designer", locale });
  const designs = await getOwnDesigns(locale);
  if (!designs.ok) return <AccountUnavailable retryHref="/account/designer/designs" />;
  const sp = await searchParams;
  const t = await getTranslations("Designers");
  const { items, limits } = designs.data;
  const used = limits.published + limits.pending_review;

  return (
    <div className="space-y-6">
      <AccountHeading title={t("studio.title")} intro={t("studio.designsIntro")} />
      <StudioNav current="designs" />
      {sp.deleted ? <Notice>{t("studio.deleted")}</Notice> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" data-testid="quota">
          {limits.entitled && limits.max_published_designs !== null ? t("studio.quota", { used, max: limits.max_published_designs }) : t("studio.quotaDraft")}
        </p>
        <Link href="/account/designer/designs/new" className={buttonClass({ variant: "brand" })} data-testid="new-design">
          <Plus className="size-4.5" aria-hidden />
          {t("studio.newDesign")}
        </Link>
      </div>

      {items.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="own-designs">
          {items.map((d) => {
            const cover = d.images.find((i) => i.id === d.cover_media_id) ?? d.images[0];
            return (
              <li key={d.id} className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
                <AppImage src={cover?.url} unoptimized={cover?.protected} alt="" ratio="4/3" sizes="(min-width: 1280px) 25vw, 50vw" fallbackLabel={d.title} />
                <div className="space-y-2 p-4">
                  <StatusBadge tone={designTone(d.status)}>{t(`studio.designStatus.${d.status}`)}</StatusBadge>
                  <h2 className="line-clamp-2 font-bold">{d.title}</h2>
                  {d.status === "published" && !studio.data.publicly_visible ? <p className="text-sm text-muted-foreground">{t("studio.publishedHiddenShort")}</p> : null}
                  {d.moderation_reason ? <p className="line-clamp-2 text-sm text-muted-foreground">{t("studio.reason", { reason: d.moderation_reason })}</p> : null}
                  {d.updated_at ? <p className="text-xs text-muted-foreground">{t("studio.updated", { date: formatDate(d.updated_at, locale) })}</p> : null}
                  <Link href={`/account/designer/designs/${d.id}`} className={buttonClass({ variant: "outline", size: "sm" })} aria-label={`${t("studio.edit")}: ${d.title}`}>
                    {t("studio.edit")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <StatusPanel
          icon={<PenTool className="size-6" />}
          title={t("studio.emptyTitle")}
          body={t("studio.emptyBody")}
          action={
            <Link href="/account/designer/designs/new" className={buttonClass({ variant: "brand" })}>
              {t("studio.newDesign")}
            </Link>
          }
        />
      )}
    </div>
  );
}
