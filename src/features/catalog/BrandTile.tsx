import { Tag } from "lucide-react";
import { AppImage } from "@/components/shared/AppImage";
import { Link } from "@/lib/i18n/navigation";

/**
 * Brand tile, the same everywhere: a light logo plate (logos are drawn for
 * white, in both themes) with the name beneath. A brand without a logo keeps
 * the same box with a quiet icon; a logo is never invented.
 */
export function BrandTile({ name, slug, logo }: { name: string; slug: string; logo: string | null | undefined }) {
  return (
    <Link
      href={`/brands/${slug}`}
      className="group flex h-full flex-col rounded-card bg-surface p-2 shadow-card ring-1 ring-border/70 transition-[box-shadow,transform] duration-(--duration-base) ease-out-soft hover:-translate-y-0.5 hover:shadow-raised"
    >
      <span className="block overflow-hidden rounded-well bg-on-media">
        {logo ? (
          <AppImage
            src={logo}
            alt=""
            ratio="3/2"
            fit="contain"
            sizes="(min-width: 1280px) 15vw, (min-width: 1024px) 19vw, (min-width: 640px) 24vw, 42vw"
            className="p-3 transition-transform duration-(--duration-slow) ease-out-soft group-hover:scale-[1.05]"
          />
        ) : (
          <span className="grid aspect-[3/2] place-items-center text-on-media-foreground/35" aria-hidden>
            <Tag className="size-7" />
          </span>
        )}
      </span>
      <span className="flex min-h-11 items-center justify-center truncate px-2 pt-1 text-center text-sm font-bold text-foreground group-hover:text-brand-text">{name}</span>
    </Link>
  );
}
