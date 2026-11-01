import type { Product } from "@smartroute/core/domain/entities/product";
import type { ClassificationLayer } from "../classification-layer.interface";
import { diceCoefficient } from "../dice-coefficient";
import { sameHeadWord } from "../head-word";
import { fuzzyAliasMatch } from "../imported-aliases";
import { fuzzyCore } from "../list-line";

export { sameHeadWord };

export const HIGH_CONFIDENCE_THRESHOLD = 0.85;
export const MIN_THRESHOLD = 0.6;
export const MAX_ALTERNATIVES = 3;

/**
 * Scores every product against the normalized input regardless of threshold, sorted best
 * first - unlike classify() below (which only accepts >= MIN_THRESHOLD), this powers the
 * Classification Review screen's "closest suggestions" for items no layer could resolve.
 */
export function scoreCandidates(
  normalized: string,
  products: Product[],
): Array<{ productId: string; confidence: number }> {
  const scored: Array<{ productId: string; confidence: number }> = [];
  for (const product of products) {
    let best = 0;
    for (const alias of product.normalizedAliases) {
      const score = diceCoefficient(normalized, alias);
      if (score > best) best = score;
    }
    if (best > 0) scored.push({ productId: product.id, confidence: best });
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored;
}

/**
 * The fuzzy layer's pick: scored over the line without counts and brands, and
 * only over aliases that pass sameHeadWord; null below MIN_THRESHOLD. `scored`
 * is every candidate that clears it, best first.
 */
export function fuzzyMatch(
  normalized: string,
  products: Product[],
): { match: { productId: string; confidence: number } | null; scored: Array<{ productId: string; confidence: number }> } {
  const core = fuzzyCore(normalized);
  const scored: Array<{ productId: string; confidence: number }> = [];
  for (const product of products) {
    let best = 0;
    for (const alias of product.normalizedAliases) {
      if (!sameHeadWord(core, alias)) continue;
      const score = diceCoefficient(core, alias);
      if (score > best) best = score;
    }
    if (best >= MIN_THRESHOLD) scored.push({ productId: product.id, confidence: best });
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  return { match: scored[0] ?? null, scored };
}

export const fuzzyMatchLayer: ClassificationLayer = {
  name: "fuzzy",
  acceptThreshold: MIN_THRESHOLD,
  async classify(_rawText, ctx) {
    const { match: top, scored } = fuzzyMatch(ctx.normalized, ctx.products);
    // The imported products' aliases are typo targets too ("במבע" -> "במבה"): the closer
    // spelling wins, a generic product on a tie.
    const alias = ctx.aliases ? fuzzyAliasMatch(ctx.normalized, ctx.aliases, MIN_THRESHOLD) : null;
    if (alias && (!top || alias.confidence > top.confidence)) {
      return { alias: alias.hit, confidence: alias.confidence };
    }
    if (!top) return null;

    if (top.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return { productId: top.productId, confidence: top.confidence };
    }

    // Below the high-confidence bar: still return the best guess, but attach
    // the top candidates so the Classification Review screen can let the
    // user confirm or pick a different one instead of silently trusting it.
    return {
      productId: top.productId,
      confidence: top.confidence,
      alternatives: scored.slice(0, MAX_ALTERNATIVES),
    };
  },
};
