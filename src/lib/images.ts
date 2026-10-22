/**
 * Image source resolution — the ONLY place that knows the API's image fields.
 *
 * Today the API returns a single original URL (`primary_image_url`,
 * `image_url`, `logo_url`). The backend is rolling out optional responsive
 * renditions (`primary_image.renditions.{thumbnail,card,detail,large}` with
 * widths). When present, we pick the smallest rendition that covers the
 * slot; when absent, we fall back to the original. next/image then produces
 * device-sized variants from whichever source we chose.
 */

export type ImagePurpose = "thumbnail" | "card" | "detail" | "large";

/** Rendition preference per purpose, best first; "original" is the final fallback. */
const PREFERENCE: Record<ImagePurpose, string[]> = {
  thumbnail: ["thumbnail", "card", "detail", "large"],
  card: ["card", "detail", "large"],
  detail: ["detail", "large", "card"],
  large: ["large", "detail"],
};

export interface RenditionLike {
  url?: string | null;
  width_px?: number | null;
  height_px?: number | null;
}

export interface ImageSourceInput {
  /** Original URL (always present on today's API when an image exists). */
  url?: string | null;
  /** Optional responsive renditions, keyed by name. */
  renditions?: Record<string, RenditionLike> | null;
  width?: number | null;
  height?: number | null;
}

export interface ResolvedImage {
  src: string;
  width: number | null;
  height: number | null;
}

export function isUsableUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return value.startsWith("/");
  }
}

export function resolveImage(input: ImageSourceInput | null | undefined, purpose: ImagePurpose): ResolvedImage | null {
  if (!input) return null;

  for (const name of PREFERENCE[purpose]) {
    const rendition = input.renditions?.[name];
    if (rendition && isUsableUrl(rendition.url)) {
      return { src: rendition.url, width: rendition.width_px ?? null, height: rendition.height_px ?? null };
    }
  }

  const original = input.renditions?.original;
  if (original && isUsableUrl(original.url)) {
    return { src: original.url, width: original.width_px ?? null, height: original.height_px ?? null };
  }

  if (isUsableUrl(input.url)) return { src: input.url, width: input.width ?? null, height: input.height ?? null };
  return null;
}

/** Product cards: future `primary_image` renditions first, then `primary_image_url`. */
export function productCardImage(
  product: {
    primary_image_url: string | null;
    primary_image?: { renditions?: Record<string, RenditionLike> | null; width_px?: number | null; height_px?: number | null } | null;
  },
  purpose: ImagePurpose = "card",
): ResolvedImage | null {
  return resolveImage(
    {
      url: product.primary_image_url,
      renditions: product.primary_image?.renditions,
      width: product.primary_image?.width_px,
      height: product.primary_image?.height_px,
    },
    purpose,
  );
}
