import type { ILLMClassifier } from "@/src/infrastructure/llm/llm-classifier.interface";
import type { ClassificationLayer } from "../classification-layer.interface";

const CONFIDENCE_CAP = 0.8;

export function createLlmFallbackLayer(classifier: ILLMClassifier): ClassificationLayer {
  return {
    name: "llm",
    acceptThreshold: 0.5,
    async classify(rawText, ctx) {
      const catalogSummary = ctx.products.map((p) => ({
        id: p.id,
        canonicalName: p.canonicalName,
        category: p.category,
        department: p.department,
      }));
      const result = await classifier.classifyProduct(rawText, catalogSummary);
      if (!result.productId) return null;
      return {
        productId: result.productId,
        confidence: Math.min(result.confidence, CONFIDENCE_CAP),
      };
    },
  };
}
