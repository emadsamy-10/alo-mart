"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/**
 * Render-time failure inside a localized page; header and footer stay usable.
 * "Try again" uses retry(), which RE-FETCHES the server segment (reset() would
 * only re-render it and keep failing after an API outage has ended).
 */
export default function LocaleError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useTranslations("States");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16 sm:py-24">
      <StatusPanel
        tone="error"
        headingLevel={1}
        icon={<AlertTriangle className="size-6" />}
        title={t("unexpectedTitle")}
        body={t("unexpectedBody")}
        action={
          <>
            <button type="button" onClick={() => retry()} className={buttonClass({ variant: "primary" })}>
              {t("retry")}
            </button>
            <Link href="/" className={buttonClass({ variant: "outline" })}>
              {t("backHome")}
            </Link>
          </>
        }
      />
    </Container>
  );
}
