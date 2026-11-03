import { CloudOff } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { StatusPanel } from "@/components/shared/StatusPanel";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/** The account API could not be reached: an error, never a fake empty state. */
export async function AccountUnavailable({ retryHref }: { retryHref: string }) {
  const t = await getTranslations("Account.errors");
  return (
    <StatusPanel
      tone="error"
      icon={<CloudOff className="size-6" />}
      title={t("unavailableTitle")}
      body={t("unavailableBody")}
      action={
        <Link href={retryHref} className={buttonClass({ variant: "primary" })}>
          {t("retry")}
        </Link>
      }
    />
  );
}
