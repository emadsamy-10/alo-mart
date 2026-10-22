import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/** Rendered with a real 404 status; Next adds `noindex` automatically. */
export default function NotFound() {
  const t = useTranslations("States");
  return (
    <Container className="py-16 sm:py-24">
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
