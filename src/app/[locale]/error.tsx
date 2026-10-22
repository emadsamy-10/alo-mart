"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Container } from "@/components/shared/Container";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/** Render-time failure inside a localized page; header and footer stay usable. */
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
            <button type="button" onClick={reset} className={buttonClass({ variant: "primary" })}>
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
