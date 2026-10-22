/** One gallery image with the rendition chosen for each display size. */
export interface GalleryImage {
  id: number;
  alt: string;
  /** small rendition for thumbnails */
  thumb: string | null;
  /** detail rendition for the main image */
  main: string | null;
  /** large rendition (or original) — only requested in the zoom viewer */
  large: string | null;
}
