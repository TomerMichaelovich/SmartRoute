import type { ClassificationAlternative, ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import { diceCoefficient } from "./dice-coefficient";
import { dictionaryLayer } from "./layers/dictionary-layer";
import { HIGH_CONFIDENCE_THRESHOLD, MAX_ALTERNATIVES, fuzzyMatchLayer } from "./layers/fuzzy-match-layer";
import { normalizationLayer } from "./layers/normalization-layer";
import { normalizeHebrewText } from "./normalize-hebrew-text";
import { resolveBeforeBranch } from "./resolve-before-branch";

/** Below this, a "suggestion" is noise rather than a plausible correction. */
const MIN_SUGGESTION_CONFIDENCE = 0.3;

const LOCAL_LAYERS = [dictionaryLayer, normalizationLayer, fuzzyMatchLayer];

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Bigram overlap alone favours long names that merely contain the typed word
 * ("קלה" -> "פילה בקלה" over "קולה"), so for suggestions each alias also gets
 * an edit-distance score - what a typo actually is - and the better one counts.
 */
function rankSuggestions(normalized: string, products: Product[]): ClassificationAlternative[] {
  const scored: ClassificationAlternative[] = [];
  for (const product of products) {
    let best = 0;
    for (const alias of product.normalizedAliases) {
      const edit = 1 - levenshtein(normalized, alias) / Math.max(normalized.length, alias.length);
      best = Math.max(best, edit, diceCoefficient(normalized, alias));
    }
    if (best >= MIN_SUGGESTION_CONFIDENCE) scored.push({ productId: product.id, confidence: best });
  }
  return scored.sort((a, b) => b.confidence - a.confidence).slice(0, MAX_ALTERNATIVES);
}

/**
 * Checks one typed item on the device, before it's added, so a typo can be
 * caught with a "did you mean...?" right away. Runs the classification
 * pipeline's offline layers (no LLM, no cache) and reads the outcome the way
 * the list does before a branch is picked (resolveBeforeBranch).
 *
 * Returns [] when the text is fine as typed (a confident match) or when
 * nothing comes close - then it's simply added and the server classifies it.
 * Otherwise returns the closest generic products, best first.
 */
export async function suggestBeforeAdding(rawText: string, products: Product[]): Promise<ClassificationAlternative[]> {
  const normalized = normalizeHebrewText(rawText);
  if (!normalized) return [];

  let result: ClassificationResult = { rawText, confidence: 0, source: "unresolved" };
  for (const layer of LOCAL_LAYERS) {
    const match = await layer.classify(rawText, { normalized, products });
    if (match && match.confidence >= layer.acceptThreshold) {
      result = {
        rawText,
        matchedProductId: match.productId,
        confidence: match.confidence,
        source: layer.name,
        alternativeMatches: match.alternatives,
      };
      break;
    }
  }

  const resolved = resolveBeforeBranch(result, products);
  if (resolved.matchedProductId && resolved.confidence >= HIGH_CONFIDENCE_THRESHOLD) return [];

  // Only generic products, as everywhere before a branch is picked.
  const suggestions = rankSuggestions(normalized, products.filter((p) => !p.chainId));
  // A weak match with nothing else close is still worth confirming.
  if (suggestions.length === 0 && resolved.matchedProductId) {
    return [{ productId: resolved.matchedProductId, confidence: resolved.confidence }];
  }
  return suggestions;
}
