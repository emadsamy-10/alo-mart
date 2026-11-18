import { Headset, PackageSearch, Store, Truck, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Container } from "@/components/shared/Container";
import { Link } from "@/lib/i18n/navigation";

interface Benefit {
  key: "stores" | "delivery" | "orders" | "support";
  Icon: LucideIcon;
  href?: string;
  mail?: string;
}

/**
 * Shopping facts the platform really provides. Wording is deliberately factual:
 * no delivery guarantee or return policy exists to promise. Support appears only
 * when the platform publishes an address.
 */
export function BenefitsStrip({ supportEmail }: { supportEmail: string | null }) {
  const t = useTranslations("Benefits");
  const items: Benefit[] = [
    { key: "stores", Icon: Store, href: "/stores" },
    { key: "delivery", Icon: Truck },
    { key: "orders", Icon: PackageSearch, href: "/account/orders" },
    ...(supportEmail ? [{ key: "support" as const, Icon: Headset, mail: supportEmail }] : []),
  ];

  return (
    <Container as="section" aria-label={t("label")} className="pt-3 lg:pt-4">
      <ul
        data-testid="benefits"
        className="grid grid-cols-1 divide-y divide-border rounded-card bg-surface shadow-card ring-1 ring-border/70 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] sm:divide-x sm:divide-y-0"
      >
        {items.map(({ key, Icon, href, mail }) => {
          const body = (
            <>
              <Icon className="size-8 shrink-0 text-brand-text" strokeWidth={1.5} aria-hidden />
              <span className="min-w-0">
                <span className="block text-sm font-extrabold lg:text-[0.9375rem]">{t(`${key}Title`)}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground lg:text-[0.8125rem]">{t(`${key}Body`)}</span>
              </span>
            </>
          );
          const row = "flex min-h-[4.5rem] items-center gap-3.5 px-5 py-3 transition-colors";
          return (
            <li key={key} className="min-w-0">
              {href ? (
                <Link href={href} className={`${row} hover:text-brand-text`}>
                  {body}
                </Link>
              ) : mail ? (
                <a href={`mailto:${mail}`} className={`${row} hover:text-brand-text`}>
                  {body}
                </a>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
