import type { ApiErrorKind } from "./client";

/**
 * Thrown by a page when its primary catalog data could not be loaded
 * (network, timeout, server or invalid response — never "not found").
 *
 * Next renders the localized error boundary with an HTTP 500, so crawlers
 * treat an API outage as temporary and keep the indexed page, instead of
 * receiving an error message with a 200 status (indexable thin content) or
 * a 404 (which would deindex a product that still exists).
 */
export class CatalogUnavailableError extends Error {
  constructor(readonly kind: ApiErrorKind) {
    super(`Catalog API unavailable (${kind})`);
    this.name = "CatalogUnavailableError";
  }
}
