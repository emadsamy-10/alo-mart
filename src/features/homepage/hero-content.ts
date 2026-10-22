import type { ProductCard } from "@/lib/api/schemas";
import { productCardImage, type ResolvedImage } from "@/lib/images";
import type { HomepageSection } from "./model";

/**
 * Hero content is chosen from what the Admin already curated — there is no
 * banner/CMS endpoint, so nothing here is invented:
 *   - main banner: a product from the first `featured_products` section
 *     (else the first product section), preferring a landscape photo that
 *     suits a wide banner;
 *   - side cards: the Admin's category-targeted product sections (title +
 *     target category + a product photo from that section), topped up with
 *     departments that have their own image.
 */

export interface HeroFeature {
  product: ProductCard;
  image: ResolvedImage;
  /** Admin's title of the section the product came from (e.g. "Featured Products"). */
  eyebrow: string | null;
}

export interface HeroPromo {
  key: string;
  title: string;
  href: string;
  image: ResolvedImage;
}

export interface HeroDepartment {
  name: string;
  slug: string;
  imageUrl: string | null;
}

export interface HeroContent {
  feature: HeroFeature | null;
  promos: HeroPromo[];
}

type ProductSection = Extract<HomepageSection, { kind: "product" }>;

const isLandscape = (img: ResolvedImage) => !!img.width && !!img.height && img.width > img.height * 1.15;

function bestImage(products: ProductCard[], preferLandscape: boolean, exclude: Set<number>) {
  const candidates = products
    .filter((p) => !exclude.has(p.id))
    .map((p) => ({ product: p, image: productCardImage(p, "large") }))
    .filter((c): c is { product: ProductCard; image: ResolvedImage } => c.image !== null);
  return (preferLandscape && candidates.find((c) => isLandscape(c.image))) || candidates[0] || null;
}

export function pickHeroContent(sections: HomepageSection[], departments: HeroDepartment[], maxPromos = 2): HeroContent {
  const productSections = sections.filter((s): s is ProductSection => s.kind === "product");
  const used = new Set<number>();

  const source = productSections.find((s) => s.type === "featured_products") ?? productSections[0];
  const main = source ? bestImage(source.items, true, used) : null;
  if (main) used.add(main.product.id);

  const promos: HeroPromo[] = [];
  for (const section of productSections) {
    if (promos.length >= maxPromos) break;
    if (section.type !== "category_products" || section.target?.kind !== "category") continue;
    const target = section.target;
    if (promos.some((p) => p.href === `/categories/${target.slug}`)) continue;
    const pick = bestImage(section.items, true, used);
    if (!pick) continue;
    used.add(pick.product.id);
    const department = departments.find((d) => d.slug === target.slug);
    promos.push({
      key: section.id,
      title: department?.name ?? section.title ?? target.slug,
      href: `/categories/${target.slug}`,
      image: pick.image,
    });
  }

  for (const department of departments) {
    if (promos.length >= maxPromos) break;
    if (!department.imageUrl || promos.some((p) => p.href === `/categories/${department.slug}`)) continue;
    promos.push({
      key: department.slug,
      title: department.name,
      href: `/categories/${department.slug}`,
      image: { src: department.imageUrl, width: null, height: null },
    });
  }

  return {
    feature: main ? { product: main.product, image: main.image, eyebrow: source?.title ?? null } : null,
    promos,
  };
}
