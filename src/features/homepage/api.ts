import "server-only";
import { cache } from "react";
import { apiGet, type ApiResult } from "@/lib/api/client";
import { homepagePayloadSchema, mapHomepageSections, type HomepageSection } from "./model";

/**
 * GET /homepage?market= — the Admin-controlled merchandising for one market,
 * localized by Accept-Language. 60s revalidation: Admin reorders appear within
 * a minute without a deploy, and prices on cards are never far behind.
 */
export const getHomepage = cache(
  async (locale: string, market: string): Promise<ApiResult<{ market: string; sections: HomepageSection[] }>> => {
    const result = await apiGet("homepage", homepagePayloadSchema, {
      locale,
      query: { market },
      revalidate: 60,
      tags: ["homepage", `homepage:${market}`],
    });
    if (!result.ok) return result;
    return { ok: true, data: { market: result.data.market.code, sections: mapHomepageSections(result.data.sections) } };
  },
);
