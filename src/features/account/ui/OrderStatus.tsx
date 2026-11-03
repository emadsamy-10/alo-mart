import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils/cn";

const KNOWN = new Set(["placed", "confirmed", "processing", "shipped", "delivered", "cancelled", "refunded"]);

/** Order status chip. Statuses the website does not know yet are shown neutrally, never guessed. */
export async function OrderStatus({ status }: { status: string }) {
  const t = await getTranslations("Account.orders.status");
  const known = KNOWN.has(status);
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold",
        status === "cancelled" || status === "refunded" ? "bg-danger-soft text-danger" : status === "delivered" ? "bg-success-soft text-success" : "bg-surface-muted text-foreground",
      )}
    >
      {known ? t(status as "placed") : t("other")}
    </span>
  );
}
