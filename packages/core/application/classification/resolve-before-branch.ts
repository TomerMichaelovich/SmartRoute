import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import { fuzzyMatch, MAX_ALTERNATIVES, scoreCandidates } from "./layers/fuzzy-match-layer";
import { normalizeHebrewText } from "./normalize-hebrew-text";

/**
 * How a list item reads before any branch is picked (the app's home list and
 * list screen). Classification matches against the whole catalog, including
 * products exclusive to one chain (Product.chainId) - but until the shopper
 * picks a branch nobody knows which chain that is, so a typo like "קפו" must
 * not turn into one chain's private-label coffee. Here:
 * - a generic match stays;
 * - a chain product the shopper named exactly (or picked by hand - both
 *   confidence 1) stays too - unless a generic product has that exact
 *   name/alias, then that one;
 * - any other chain-product match (a fuzzy guess) is re-done against generic
 *   products only, the same way the fuzzy layer would;
 * - suggestions only ever offer generic products.
 *
 * Display-only: the stored classification is left as is, and picking a branch
 * re-resolves it against what that branch carries (resolveAvailability).
 */
export function resolveBeforeBranch(result: ClassificationResult, products: Product[]): ClassificationResult {
  const generic = products.filter((p) => !p.chainId);
  const normalized = normalizeHebrewText(result.rawText);
  const matched = result.matchedProductId ? products.find((p) => p.id === result.matchedProductId) : undefined;
  const genericSuggestions = () => scoreCandidates(normalized, generic).slice(0, MAX_ALTERNATIVES);

  if (matched && !matched.chainId) {
    return result.alternativeMatches ? { ...result, alternativeMatches: genericSuggestions() } : result;
  }

  if (matched) {
    const genericExact = generic.find((p) => p.normalizedAliases.includes(normalized));
    if (genericExact) {
      return { rawText: result.rawText, matchedProductId: genericExact.id, confidence: 1, source: "dictionary" };
    }
    if (result.confidence >= 1 || matched.normalizedAliases.includes(normalized)) {
      return { ...result, alternativeMatches: undefined };
    }
  } else if (result.source !== "unresolved") {
    // Matched a product that's no longer in the catalog - nothing to fix here.
    return result;
  }

  const scored = genericSuggestions();
  const { match: top } = fuzzyMatch(normalized, generic);
  if (top) {
    return {
      rawText: result.rawText,
      matchedProductId: top.productId,
      confidence: top.confidence,
      source: "fuzzy",
      alternativeMatches: scored,
    };
  }
  return {
    rawText: result.rawText,
    confidence: 0,
    source: "unresolved",
    alternativeMatches: scored.length > 0 ? scored : undefined,
  };
}
