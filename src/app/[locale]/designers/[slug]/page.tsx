import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, MapPin, PenTool, UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { getDesigner, publicErrorKind } from "@/features/designers/api";
import { DesignCard } from "@/features/designers/ui/Cards";
import { InspirationToggle } from "@/features/designers/ui/InspirationToggle";
import { VideoEmbed } from "@/features/designers/ui/VideoEmbed";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { formatDate } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/designers/[slug]">;

const SLUG = /^[a-z0-9-]{1,90}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  if (!SLUG.test(slug)) return {};
  const result = await getDesigner(locale, slug);
  if (!result.ok) return {};
  const d = result.data;
  const image = d.cover_url ?? d.avatar_url;
  return pageMetadata({
    locale,
    path: `/designers/${d.slug}`,
    title: d.display_name,
    description: (d.headline ?? d.bio ?? d.display_name).slice(0, 160),
    ...(image ? { image: { url: image, alt: d.display_name } } : {}),
  });
}

/** Public designer profile: cover, avatar, bio, specialties, links, published portfolio and videos. */
export default async function DesignerProfilePage({ params }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  if (!SLUG.test(slug)) notFound();
  const result = await getDesigner(locale, slug);
  if (!result.ok) {
    if (result.error.kind === "not_found") notFound();
    throw new CatalogUnavailableError(publicErrorKind(result.error.kind));
  }
  const d = result.data;
  const [t, tc] = await Promise.all([getTranslations("Designers"), getTranslations("Common")]);

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("hub.title"), href: "/designers?tab=designers" }, { name: d.display_name }]} />

      <header className="mt-4 overflow-hidden rounded-panel border border-border bg-surface">
        <div className="relative h-36 bg-surface-muted sm:h-56">{d.cover_url ? <AppImage src={d.cover_url} alt="" ratio="fill" priority sizes="100vw" /> : null}</div>
        <div className="flex flex-col gap-4 px-5 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
            <span className="-mt-12 block size-24 shrink-0 overflow-hidden rounded-full bg-surface ring-4 ring-surface sm:size-28">
              {d.avatar_url ? (
                <AppImage src={d.avatar_url} alt={d.display_name} ratio="1/1" sizes="112px" />
              ) : (
                <span className="grid size-full place-items-center bg-surface-muted text-muted-foreground" aria-hidden>
                  <UserRound className="size-10" />
                </span>
              )}
            </span>
            <div className="min-w-0">
              <h1 dir="auto" className="tracking-display text-2xl font-extrabold sm:text-3xl">{d.display_name}</h1>
              {d.headline ? <p dir="auto" className="mt-1 text-muted-foreground">{d.headline}</p> : null}
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {d.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden />
                    {d.city}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <PenTool className="size-4" aria-hidden />
                  {t("card.designs", { count: d.designs_count })}
                </span>
              </p>
            </div>
          </div>
          {d.viewer.is_owner ? (
            <div className="text-sm">
              <p className="text-muted-foreground">{t("designer.ownProfile")}</p>
              <Link href="/account/designer" className="font-semibold text-brand-text hover:underline">
                {t("designer.editInStudio")}
              </Link>
            </div>
          ) : (
            <InspirationToggle kind="designer" slug={d.slug} name={d.display_name} active={d.viewer.following} signedIn={d.viewer.signed_in} back={`/designers/${d.slug}`} />
          )}
        </div>
      </header>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-6">
          {d.bio ? (
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="text-lg font-bold">
                {t("designer.about")}
              </h2>
              <p dir="auto" className="mt-2 leading-relaxed whitespace-pre-line text-foreground/90">{d.bio}</p>
            </section>
          ) : null}
          {d.specialties.length ? (
            <section aria-labelledby="specialties-heading">
              <h2 id="specialties-heading" className="text-lg font-bold">
                {t("designer.specialties")}
              </h2>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {d.specialties.map((s) => (
                  <li key={s} className="rounded-full bg-surface-muted px-3 py-1 text-sm">
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {d.links.length ? (
            <section aria-labelledby="links-heading">
              <h2 id="links-heading" className="text-lg font-bold">
                {t("designer.links")}
              </h2>
              <ul className="mt-2 space-y-1">
                {d.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex min-h-11 items-center gap-1.5 font-semibold break-all text-brand-text hover:underline" dir="ltr">
                      {l.label || l.url}
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {d.member_since ? <p className="text-sm text-muted-foreground">{t("designer.memberSince", { date: formatDate(d.member_since, locale) })}</p> : null}
        </aside>

        <div className="min-w-0 space-y-10">
          <section aria-labelledby="portfolio-heading">
            <h2 id="portfolio-heading" className="text-2xl font-bold">
              {t("designer.portfolio")}
            </h2>
            {d.designs.length ? (
              <ul className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-3" data-testid="portfolio">
                {d.designs.map((design) => (
                  <li key={design.slug}>
                    <DesignCard design={design} />
                  </li>
                ))}
              </ul>
            ) : (
              <StatusPanel
                className="mt-4"
                icon={<PenTool className="size-6" />}
                title={t("designer.emptyPortfolio")}
                action={
                  <Link href="/designers" className={buttonClass({ variant: "outline" })}>
                    {t("inspiration.browse")}
                  </Link>
                }
              />
            )}
          </section>
          {d.videos.length ? (
            <section aria-labelledby="videos-heading">
              <h2 id="videos-heading" className="text-2xl font-bold">
                {t("designer.videos")}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {d.videos.map((v) => (
                  <VideoEmbed key={v.id} video={{ ...v, alt_text: v.alt_text ?? v.design_title ?? null }} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
