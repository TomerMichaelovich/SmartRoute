import type { ClassificationLayer } from "../classification-layer.interface";
import { normalizeHebrewText } from "../normalize-hebrew-text";

/**
 * Exact match of the normalized raw text against a product's canonical name or
 * aliases. A product named exactly that wins over one that merely answers to it:
 * "קפה נמס" is "קפה נמס", not "קפה נמס בריסטה" with the alias "קפה נמס".
 */
export const dictionaryLayer: ClassificationLayer = {
  name: "dictionary",
  acceptThreshold: 1,
  async classify(_rawText, ctx) {
    const named = ctx.products.find((product) => normalizeHebrewText(product.canonicalName) === ctx.normalized);
    if (named) return { productId: named.id, confidence: 1 };
    for (const product of ctx.products) {
      if (product.normalizedAliases.includes(ctx.normalized)) {
        return { productId: product.id, confidence: 1 };
      }
    }
    return null;
  },
};
