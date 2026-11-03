import type { Metadata } from "next";
import { Store } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AppImage } from "@/components/shared/AppImage";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { CatalogUnavailableError } from "@/lib/api/errors";
import { getStores } from "@/features/catalog/api";
import { Link } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/stores">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Store" });
  return pageMetadata({ locale, path: "/stores", title: t("all"), description: t("allDescription") });
}

/** Every public store on ALO MART (the API lists only eligible, public stores). */
export default async function StoresPage({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tc, stores] = await Promise.all([getTranslations("Store"), getTranslations("Common"), getStores(locale)]);
  if (!stores.ok) throw new CatalogUnavailableError(stores.error.kind);
  const items = stores.data.items;

  return (
    <Container className="pt-6 pb-12 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("all") }]} />
      <h1 className="tracking-display mt-4 mb-2 text-3xl font-extrabold sm:text-4xl">{t("all")}</h1>
      <p className="mb-6 max-w-2xl text-muted-foreground">{t("allDescription")}</p>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="stores">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/stores/${s.slug}`} className="group flex h-full flex-col items-center gap-3 rounded-panel border border-border bg-surface p-5 text-center shadow-card transition hover:border-border-strong">
                <span className="w-20 overflow-hidden rounded-card bg-white ring-1 ring-border">
                  {s.logo ? (
                    <AppImage src={s.logo} alt="" ratio="1/1" fit="contain" sizes="80px" className="p-2" />
                  ) : (
                    <span className="grid aspect-square place-items-center text-muted-foreground" aria-hidden>
                      <Store className="size-7" />
                    </span>
                  )}
                </span>
                <span className="font-bold group-hover:text-brand-text">{s.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <StatusPanel icon={<Store className="size-6" />} title={t("noneTitle")} body={t("noneBody")} />
      )}
    </Container>
  );
}
