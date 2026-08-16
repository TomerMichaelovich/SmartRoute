import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import type { ProductListing } from "@/src/domain/entities/product-listing";

/**
 * Classification matches against the whole shared catalog, so a matched product isn't
 * necessarily carried by the requesting store. Cheap, per-request, not cached (unlike
 * classify() itself) - checks the store's own listings and marks the result unavailable
 * there if none exists, without touching matchedProductId/confidence/source.
 */
export function resolveAvailability(
  result: ClassificationResult,
  storeId: string,
  listings: ProductListing[],
): ClassificationResult {
  if (!result.matchedProductId) return result;
  const carried = listings.some(
    (l) => l.productId === result.matchedProductId && l.storeId === storeId,
  );
  return carried ? result : { ...result, availableAtStore: false };
}
