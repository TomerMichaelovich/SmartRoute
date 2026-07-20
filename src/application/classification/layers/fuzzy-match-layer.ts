import type { ClassificationLayer } from "../classification-layer.interface";
import { diceCoefficient } from "../dice-coefficient";

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const MIN_THRESHOLD = 0.6;
const MAX_ALTERNATIVES = 3;

export const fuzzyMatchLayer: ClassificationLayer = {
  name: "fuzzy",
  acceptThreshold: MIN_THRESHOLD,
  async classify(_rawText, ctx) {
    const scored: Array<{ productId: string; confidence: number }> = [];

    for (const product of ctx.products) {
      let best = 0;
      for (const alias of product.normalizedAliases) {
        const score = diceCoefficient(ctx.normalized, alias);
        if (score > best) best = score;
      }
      if (best >= MIN_THRESHOLD) {
        scored.push({ productId: product.id, confidence: best });
      }
    }

    if (scored.length === 0) return null;
    scored.sort((a, b) => b.confidence - a.confidence);
    const top = scored[0];

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
