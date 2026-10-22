import createMiddleware from "next-intl/middleware";
import { routing } from "@/lib/i18n/routing";

/** Locale negotiation: `/` → `/ar` or `/en` (cookie, then Accept-Language). */
export default createMiddleware(routing);

export const config = {
  // Everything except API routes, Next internals, metadata files and static assets.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
