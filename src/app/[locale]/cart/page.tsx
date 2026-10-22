import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Container } from "@/components/shared/Container";
import { CartPageView } from "@/features/cart/CartPageView";
import type { Locale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/seo/site";

type Props = PageProps<"/[locale]/cart">;

/** Personal, device-local page: never indexed. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const t = await getTranslations({ locale, namespace: "Cart" });
  return pageMetadata({ locale, path: "/cart", title: t("title"), description: t("metaDescription"), noindex: true });
}

export default async function Page({ params }: Props) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, tc] = await Promise.all([getTranslations("Cart"), getTranslations("Common")]);
  return (
    <Container className="pt-6 pb-10 sm:pt-8">
      <Breadcrumbs items={[{ name: tc("home"), href: "/" }, { name: t("title") }]} />
      <h1 className="tracking-display mt-4 mb-6 text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
      <CartPageView />
    </Container>
  );
}
