import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Lock, UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { buttonClass } from "@/components/ui/button";
import { getDesign, publicErrorKind } from "@/features/designers/api";
import { DesignCard } from "@/features/designers/ui/Cards";
import { InspirationToggle } from "@/features/designers/ui/InspirationToggle";
import { VideoEmbed } from "@/features/designers/ui/VideoEmbed";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { formatDate } from "@/lib/i18n/format";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/designs/[slug]">;

const SLUG = /^[a-z0-9-]{1,140}$/;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  if (!SLUG.test(slug)) return {};
  const result = await getDesign(locale, slug);
  if (!result.ok) return {};
  const d = result.data;
  const image = d.cover?.url && !d.cover.protected ? { url: d.cover.url, alt: d.cover.alt_text ?? d.title } : undefined;
  return pageMetadata({
    locale,
    path: `/designs/${d.slug}`,
    title: d.title,
    description: (d.locked ? null : d.description)?.slice(0, 160) ?? (d.designer ? `${d.title} · ${d.designer.display_name}` : d.title),
    ...(image ? { image } : {}),
  });
}

/** Public design detail: gallery, description, videos, designer attribution. Members-only details are gated by the API. */
export default async function DesignPage({ params }: Props) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);
  if (!SLUG.test(slug)) notFound();
  const result = await getDesign(locale, slug);
  if (!result.ok) {
    if (result.error.kind === "not_found") notFound();
    throw new CatalogUnavailableError(publicErrorKind(result.error.kind));
  }
  const d = result.data;
  const [t, tc] = await Promise.all([getTranslations("Designers"), getTranslations("Common")]);
  const back = `/designs/${d.slug}`;

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("hub.title"), href: "/designers" }, { name: d.title }]} />

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-panel border border-border bg-surface">
            <AppImage src={d.cover?.url} unoptimized={d.cover?.protected} alt={d.cover?.alt_text ?? d.title} ratio="4/3" priority sizes="(min-width: 1024px) 60vw, 100vw" fallbackLabel={d.title} />
          </div>
          {!d.locked && d.images.length > 1 ? (
            <section aria-labelledby="gallery-heading">
              <h2 id="gallery-heading" className="sr-only">
                {t("design.gallery")}
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="gallery">
                {d.images
                  .filter((img) => img.id !== d.cover?.id)
                  .map((img, index) => (
                    <li key={img.id} className="overflow-hidden rounded-card border border-border">
                      <AppImage src={img.url} unoptimized={img.protected} alt={img.alt_text ?? t("design.photoOf", { index: index + 2, total: d.images.length })} ratio="1/1" sizes="(min-width: 1024px) 20vw, 50vw" />
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          {!d.locked && d.videos.length ? (
            <section aria-labelledby="videos-heading" className="space-y-3">
              <h2 id="videos-heading" className="text-xl font-bold">
                {t("design.videos")}
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {d.videos.map((v) => (
                  <VideoEmbed key={v.id} video={v} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <p className="text-sm font-semibold text-brand-text">{t(`categories.${d.category}` as never)}</p>
            <h1 dir="auto" className="tracking-display mt-1 text-3xl font-extrabold sm:text-4xl">{d.title}</h1>
            {d.published_at ? <p className="mt-2 text-sm text-muted-foreground">{t("design.published", { date: formatDate(d.published_at, locale) })}</p> : null}
          </div>

          {d.designer ? (
            <div className="flex items-center justify-between gap-3 rounded-panel border border-border bg-surface p-4">
              <Link href={`/designers/${d.designer.slug}`} className="flex min-w-0 items-center gap-3 hover:underline">
                <span className="block size-12 shrink-0 overflow-hidden rounded-full bg-surface-muted">
                  {d.designer.avatar_url ? (
                    <AppImage src={d.designer.avatar_url} alt="" ratio="1/1" sizes="48px" />
                  ) : (
                    <span className="grid size-full place-items-center text-muted-foreground" aria-hidden>
                      <UserRound className="size-6" />
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{t("design.designer")}</span>
                  <span className="block truncate font-bold">{d.designer.display_name}</span>
                </span>
              </Link>
              <InspirationToggle kind="design" slug={d.slug} name={d.title} active={d.viewer.saved} signedIn={d.viewer.signed_in} back={back} />
            </div>
          ) : null}

          {d.locked ? (
            <section aria-labelledby="locked-heading" className="rounded-panel border border-border bg-surface-muted p-5" data-testid="members-only">
              <h2 id="locked-heading" className="flex items-center gap-2 font-bold">
                <Lock className="size-5" aria-hidden />
                {t("design.lockedTitle")}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("design.lockedBody")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/subscriptions?for=customers" className={buttonClass({ variant: "brand" })}>
                  {t("design.lockedCta")}
                </Link>
                {!d.viewer.signed_in ? (
                  <Link href={`/login?next=${encodeURIComponent(back)}`} className={buttonClass({ variant: "outline" })}>
                    {t("design.lockedSignIn")}
                  </Link>
                ) : null}
              </div>
            </section>
          ) : (
            <>
              {d.description ? (
                <section aria-labelledby="about-heading">
                  <h2 id="about-heading" className="text-lg font-bold">
                    {t("design.about")}
                  </h2>
                  <p dir="auto" className="mt-2 leading-relaxed whitespace-pre-line text-foreground/90">{d.description}</p>
                </section>
              ) : null}
              {d.tags.length ? (
                <section aria-labelledby="tags-heading">
                  <h2 id="tags-heading" className="text-sm font-semibold text-muted-foreground">
                    {t("design.tags")}
                  </h2>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {d.tags.map((tag) => (
                      <li key={tag} className="rounded-full bg-surface-muted px-3 py-1 text-sm">
                        {tag}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      {d.related.length && d.designer ? (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="text-2xl font-bold">
            {t("design.moreFrom", { name: d.designer.display_name })}
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
            {d.related.map((r) => (
              <li key={r.slug}>
                <DesignCard design={r} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
