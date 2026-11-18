import type { Metadata } from "next";
import { PenTool, Search, SearchX, Users } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { Pagination, parsePage } from "@/components/shared/Pagination";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { getDesignCategories, getDesigners, getDesigns } from "@/features/designers/api";
import { DesignCard, DesignerCard } from "@/features/designers/ui/Cards";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";
import { cn } from "@/lib/utils/cn";

type Props = PageProps<"/[locale]/designers">;

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) ?? "";
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: "Designers" });
  const filtered = Boolean(one(sp.q) || one(sp.category) || one(sp.media) || one(sp.page));
  // One canonical hub URL; the Designers tab and filtered/paged views are not indexed separately.
  return pageMetadata({ locale, path: "/designers", title: t("metaTitle"), description: t("metaDescription"), noindex: filtered || one(sp.tab) === "designers" });
}

/** Designers hub: two query-driven tabs (Designs / Designers), search, category filter, pagination. */
export default async function DesignersHubPage({ params, searchParams }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const sp = await searchParams;
  const tab = one(sp.tab) === "designers" ? "designers" : "designs";
  const q = one(sp.q);
  const category = one(sp.category);
  const media = one(sp.media) === "video" ? "video" : undefined;
  const page = parsePage(sp.page);
  const [t, tc] = await Promise.all([getTranslations("Designers"), getTranslations("Common")]);

  const [list, categories] = await Promise.all([
    tab === "designs" ? getDesigns(locale, { q: q || undefined, category: category || undefined, media, page }) : getDesigners(locale, { q: q || undefined, page }),
    getDesignCategories(locale),
  ]);
  if (!list.ok) throw new CatalogUnavailableError(list.error.kind);

  const filtered = Boolean(q || (tab === "designs" && (category || media)));
  const keep: Record<string, string> = { ...(tab === "designers" ? { tab } : {}), ...(q ? { q } : {}), ...(tab === "designs" && category ? { category } : {}), ...(tab === "designs" && media ? { media } : {}) };
  const tabLink = (target: "designs" | "designers") => ({ pathname: "/designers", query: target === "designers" ? { tab: target } : {} });

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("hub.title") }]} />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="tracking-display text-3xl font-extrabold sm:text-4xl">{t("hub.title")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("hub.intro")}</p>
        </div>
        <Link href="/subscriptions" className={buttonClass({ variant: "outline" })}>
          {t("hub.plansCta")}
        </Link>
      </div>

      <nav aria-label={t("hub.tabsLabel")} className="mt-6 border-b border-border">
        <ul className="flex gap-1">
          {(["designs", "designers"] as const).map((key) => (
            <li key={key}>
              <Link
                href={tabLink(key)}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors",
                  tab === key ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                data-testid={`tab-${key}`}
              >
                {key === "designs" ? <PenTool className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}
                {key === "designs" ? t("hub.tabDesigns") : t("hub.tabDesigners")}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form role="search" action="" method="get" className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        {tab === "designers" ? <input type="hidden" name="tab" value="designers" /> : null}
        <div className="min-w-0 flex-1 sm:min-w-64">
          <label htmlFor="designers-q" className="mb-1.5 block text-sm font-semibold">
            {tab === "designs" ? t("hub.searchDesigns") : t("hub.searchDesigners")}
          </label>
          <input
            id="designers-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={100}
            className="block h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base shadow-sm hover:border-border-strong focus:border-brand focus:outline-none"
          />
        </div>
        {tab === "designs" ? (
          <>
            <div className="sm:w-56">
              <label htmlFor="designers-category" className="mb-1.5 block text-sm font-semibold">
                {t("hub.category")}
              </label>
              <select
                id="designers-category"
                name="category"
                defaultValue={category}
                className="block h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base shadow-sm hover:border-border-strong focus:border-brand focus:outline-none"
              >
                <option value="">{t("hub.allCategories")}</option>
                {(categories.ok ? categories.data : []).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="media" value="video" defaultChecked={media === "video"} className="size-5 accent-brand" />
              {t("hub.withVideo")}
            </label>
          </>
        ) : null}
        <button type="submit" className={buttonClass({ variant: "primary", size: "lg" })}>
          <Search className="size-4.5" aria-hidden />
          {t("hub.search")}
        </button>
      </form>

      <p className="mt-5 text-sm text-muted-foreground" aria-live="polite">
        {t("hub.results", { count: list.data.meta.total })}
      </p>

      {list.data.items.length ? (
        <ul className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid={`${tab}-grid`}>
          {tab === "designs"
            ? (list.data.items as Parameters<typeof DesignCard>[0]["design"][]).map((d) => (
                <li key={d.slug}>
                  <DesignCard design={d} headingLevel={2} />
                </li>
              ))
            : (list.data.items as Parameters<typeof DesignerCard>[0]["designer"][]).map((d) => (
                <li key={d.slug}>
                  <DesignerCard designer={d} headingLevel={2} />
                </li>
              ))}
        </ul>
      ) : filtered ? (
        <StatusPanel
          className="mt-4"
          icon={<SearchX className="size-6" />}
          title={t("hub.noMatchTitle")}
          body={t("hub.noMatchBody")}
          action={
            <Link href={tabLink(tab)} className={buttonClass({ variant: "outline" })}>
              {t("hub.clear")}
            </Link>
          }
        />
      ) : (
        <StatusPanel
          className="mt-4"
          icon={tab === "designs" ? <PenTool className="size-6" /> : <Users className="size-6" />}
          title={tab === "designs" ? t("hub.emptyDesignsTitle") : t("hub.emptyDesignersTitle")}
          body={tab === "designs" ? t("hub.emptyDesignsBody") : t("hub.emptyDesignersBody")}
          action={
            <Link href="/account/designer" className={buttonClass({ variant: "brand" })}>
              {t("hub.becomeDesignerCta")}
            </Link>
          }
        />
      )}

      <Pagination path="/designers" page={page} lastPage={list.data.meta.last_page} query={keep} />

      <section aria-labelledby="become-designer" className="mt-12 flex flex-col gap-4 rounded-panel border border-border bg-surface-muted p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <h2 id="become-designer" className="text-xl font-bold">
            {t("hub.becomeDesigner")}
          </h2>
          <p className="mt-1 text-muted-foreground">{t("hub.becomeDesignerBody")}</p>
        </div>
        <Link href="/account/designer" className={buttonClass({ variant: "brand", size: "lg" })}>
          {t("hub.becomeDesignerCta")}
        </Link>
      </section>
    </Container>
  );
}
