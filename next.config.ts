import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const apiBaseUrl = process.env.ALO_API_BASE_URL ?? "https://api.alo-mart.web-apps.site/api/v1";

/**
 * next/image may only optimise images from hosts we trust: the API host
 * (product media, category images, brand logos and store branding live under
 * its /storage path) plus any explicitly configured extra host.
 */
function imageRemotePatterns(): RemotePattern[] {
  const api = new URL(apiBaseUrl);
  const patterns: RemotePattern[] = [
    {
      protocol: api.protocol.replace(":", "") as "http" | "https",
      hostname: api.hostname,
      port: api.port,
      pathname: "/storage/**",
    },
  ];

  for (const host of (process.env.IMAGE_REMOTE_HOSTS ?? "").split(",")) {
    const hostname = host.trim();
    if (hostname) patterns.push({ protocol: "https", hostname, pathname: "/**" });
  }

  return patterns;
}

const indexable = process.env.SITE_INDEXABLE === "true";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: imageRemotePatterns(),
    formats: ["image/avif", "image/webp"],
    qualities: [75, 85],
    // Widest slot is the product page image (~700 CSS px → 1400 @2x); fewer
    // candidate widths = smaller srcset markup and a warmer optimizer cache.
    deviceSizes: [384, 640, 828, 1080, 1440, 1920],
    imageSizes: [96, 160, 256],
    // Product imagery changes rarely and has immutable, uuid-based URLs.
    minimumCacheTTL: 60 * 60 * 24,
  },
  async headers() {
    // Deployment-level safety net for staging: even if a page forgets its
    // robots metadata, crawlers are told not to index anything.
    return indexable
      ? []
      : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
};

export default withNextIntl(nextConfig);
