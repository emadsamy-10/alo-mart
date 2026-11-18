import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

const LINKS = [
  { key: "profile", href: "/account/designer" },
  { key: "designs", href: "/account/designer/designs" },
  { key: "subscription", href: "/account/subscription#designer" },
] as const;

/** Designer Studio: Profile | My designs | Subscription. */
export function StudioNav({ current }: { current: "profile" | "designs" }) {
  const t = useTranslations("Designers.studio");
  return (
    <nav aria-label={t("navLabel")} className="border-b border-border">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {LINKS.map(({ key, href }) => (
          <li key={key} className="shrink-0">
            <Link
              href={href}
              aria-current={current === key ? "page" : undefined}
              className={cn("inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold", current === key ? "border-brand text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
            >
              {t(`nav.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
