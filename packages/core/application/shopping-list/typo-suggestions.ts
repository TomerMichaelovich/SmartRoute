import type { Product } from "../../domain/entities/product";
import { diceCoefficient } from "../classification/dice-coefficient";
import { scoreCandidates } from "../classification/layers/fuzzy-match-layer";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";

/** Below this the "closest" product is a different word, not a typo. */
const MIN_SUGGESTION_SCORE = 0.45;

export interface TypoSuggestion {
  product: Product;
  /** What to show and write on the list: the plain name closest to what was typed ("חלב"). */
  label: string;
}

/**
 * The name a typo most likely meant, among the product's names: its aliases, its
 * full name, or the full name's first word - so "חלג" reads "חלב", not
 * "חלב 3% תנובה 1 ליטר". Closest spelling wins, the shorter on a tie.
 */
export function suggestionLabel(rawText: string, product: Product): string {
  const typed = normalizeHebrewText(rawText);
  const firstWord = product.canonicalName.trim().split(/\s+/)[0];
  const names = [...new Set([firstWord, ...product.aliases, product.canonicalName].map((n) => n.trim()).filter(Boolean))];
  let best = product.canonicalName;
  let bestScore = -1;
  for (const name of names) {
    const score = diceCoefficient(typed, normalizeHebrewText(name));
    if (score > bestScore || (score === bestScore && name.length < best.length)) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

/**
 * "Did you mean ...?" for a line nothing recognized ("חלג" -> חלב, חלה): the
 * catalog products spelled closest to it, best first, each under its plainest
 * matching name; two products that read the same are offered once. Looser than
 * the fuzzy classification layer on purpose - the shopper picks, nothing is assumed.
 */
export function typoSuggestions(rawText: string, products: Product[], max = 2): TypoSuggestion[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const suggestions: TypoSuggestion[] = [];
  const seenLabels = new Set<string>();
  for (const candidate of scoreCandidates(normalizeHebrewText(rawText), products)) {
    if (candidate.confidence < MIN_SUGGESTION_SCORE || suggestions.length >= max) break;
    const product = byId.get(candidate.productId);
    if (!product) continue;
    const label = suggestionLabel(rawText, product);
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    suggestions.push({ product, label });
  }
  return suggestions;
}
