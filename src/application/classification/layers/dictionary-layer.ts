import type { ClassificationLayer } from "../classification-layer.interface";

/** Exact match of the normalized raw text against a product's canonical name or aliases. */
export const dictionaryLayer: ClassificationLayer = {
  name: "dictionary",
  acceptThreshold: 1,
  async classify(_rawText, ctx) {
    for (const product of ctx.products) {
      if (product.normalizedAliases.includes(ctx.normalized)) {
        return { productId: product.id, confidence: 1 };
      }
    }
    return null;
  },
};
