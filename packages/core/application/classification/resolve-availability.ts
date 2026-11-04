import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import { normalizeHebrewText } from "./normalize-hebrew-text";

/**
 * Classification matches against the whole shared catalog, so a matched product isn't
 * necessarily carried by the requesting store. Cheap, per-request, not cached (unlike
 * classify() itself) - checks the store's own listings and marks the result unavailable
 * there if none exists, without touching matchedProductId/confidence/source.
 *
 * Exception: the global (cached) match picks one product even when several share the
 * exact name/alias (e.g. generic "קפה נמס" vs. a store's "קפה נמס בריסטה" aliased
 * "קפה נמס"). If the matched one isn't carried here but another exact-name match is,
 * the result is switched to that one instead of reporting "not in stock".
 *
 * Safe to re-run against a different store (e.g. when a branch is picked for routing):
 * any availability flag from a previous store is dropped first.
 */
export function resolveAvailability(
  result: ClassificationResult,
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  /**
   * False when classifying list lines (the list's store is often just a
   * placeholder until a branch is picked): only the availability flag is set,
   * so "קפה נמס" stays the generic product instead of turning into whichever
   * same-name product that store happens to carry. Routing re-resolves.
   */
  { switchToCarried = true }: { switchToCarried?: boolean } = {},
): ClassificationResult {
  const { availableAtStore: _previousStore, ...base } = result;
  if (!base.matchedProductId) return base;
  const carriedIds = new Set(
    listings.filter((l) => l.storeId === storeId).map((l) => l.productId),
  );
  if (carriedIds.has(base.matchedProductId)) return base;
  if (!switchToCarried) return { ...base, availableAtStore: false };

  const normalized = normalizeHebrewText(base.rawText);
  const carriedExactMatch = products.find(
    (p) => carriedIds.has(p.id) && p.normalizedAliases.includes(normalized),
  );
  if (carriedExactMatch) {
    return { ...base, matchedProductId: carriedExactMatch.id, confidence: 1, source: "dictionary" };
  }
  return { ...base, availableAtStore: false };
}
