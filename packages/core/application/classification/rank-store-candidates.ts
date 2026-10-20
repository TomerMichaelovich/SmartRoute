import type { Product } from "@smartroute/core/domain/entities/product";
import { diceCoefficient } from "./dice-coefficient";
import { normalizeHebrewText } from "./normalize-hebrew-text";

const MIN_FUZZY_SCORE = 0.5;

/**
 * Which of a branch's products a typed item could mean - for asking "which נס?" when a
 * shared-list participant adds something mid-shop. Name/alias matches come first (starting
 * with the text, then a word starting with it, then containing it), then close spellings.
 * `products` should be what the branch carries.
 */
export function rankStoreCandidates(rawText: string, products: Product[], limit = 4): Product[] {
  const normalized = normalizeHebrewText(rawText);
  if (!normalized) return [];
  const ranked: Array<{ product: Product; tier: number; score: number }> = [];
  for (const product of products) {
    let tier = Infinity;
    let score = 0;
    for (const alias of product.normalizedAliases) {
      if (alias === normalized || alias.startsWith(normalized)) tier = Math.min(tier, 0);
      else if (alias.split(" ").some((word) => word.startsWith(normalized))) tier = Math.min(tier, 1);
      else if (alias.includes(normalized)) tier = Math.min(tier, 2);
      score = Math.max(score, diceCoefficient(normalized, alias));
    }
    if (tier === Infinity && score >= MIN_FUZZY_SCORE) tier = 3;
    if (tier !== Infinity) ranked.push({ product, tier, score });
  }
  return ranked
    .sort((a, b) => a.tier - b.tier || b.score - a.score)
    .slice(0, limit)
    .map((r) => r.product);
}
