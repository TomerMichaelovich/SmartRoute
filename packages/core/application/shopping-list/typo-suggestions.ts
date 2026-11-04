import type { Product } from "../../domain/entities/product";
import { scoreCandidates } from "../classification/layers/fuzzy-match-layer";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";

/** Below this the "closest" product is a different word, not a typo. */
const MIN_SUGGESTION_SCORE = 0.45;

/**
 * "Did you mean ...?" for a line nothing recognized ("חלג" -> חלב, חלה): the
 * catalog products spelled closest to it, best first. Looser than the fuzzy
 * classification layer on purpose - the shopper picks, nothing is assumed.
 */
export function typoSuggestions(rawText: string, products: Product[], max = 2): Product[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return scoreCandidates(normalizeHebrewText(rawText), products)
    .filter((c) => c.confidence >= MIN_SUGGESTION_SCORE)
    .slice(0, max)
    .map((c) => byId.get(c.productId))
    .filter((p): p is Product => Boolean(p));
}
