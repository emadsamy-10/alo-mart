import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/**
 * Staging/preview (SITE_INDEXABLE != "true"): block everything.
 * Production: allow crawling, point to the sitemap.
 * Evaluated per request so the indexing flag follows the runtime environment.
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!env.indexable) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
