import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/shared/Container";
import { DocumentTitle } from "@/components/shared/DocumentTitle";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/** Its own title (the layout's default is the homepage title). */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("States");
  return { title: t("notFoundTitle") };
}

/** Rendered with a real 404 status; Next adds `noindex` automatically. */
export default function NotFound() {
  const t = useTranslations("States");
  const tm = useTranslations("Metadata");
  return (
    <Container className="py-16 sm:py-24">
      <DocumentTitle title={tm("titleTemplate").replace("%s", t("notFoundTitle"))} />
      <StatusPanel
        headingLevel={1}
        icon={<SearchX className="size-6" />}
        title={t("notFoundTitle")}
        body={t("notFoundBody")}
        action={
          <Link href="/" className={buttonClass({ variant: "primary" })}>
            {t("backHome")}
          </Link>
        }
      />
    </Container>
  );
}
