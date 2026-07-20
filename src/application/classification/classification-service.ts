import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import type { Product } from "@/src/domain/entities/product";
import type { IClassificationCacheRepository } from "@/src/infrastructure/repositories/interfaces/classification-cache-repository";
import type { IProductRepository } from "@/src/infrastructure/repositories/interfaces/product-repository";
import type { ClassificationLayer } from "./classification-layer.interface";
import { normalizeHebrewText } from "./normalize-hebrew-text";

const BATCH_CONCURRENCY = 5;

/**
 * Orchestrates the 4-layer classification pipeline: dictionary -> normalization
 * -> fuzzy -> LLM fallback, in the order the layers are supplied. Every
 * outcome (including "unresolved") is cached by normalized text so a given
 * unknown string is only ever run through the pipeline once, globally.
 */
export class ClassificationService {
  constructor(
    private readonly layers: ClassificationLayer[],
    private readonly cacheRepo: IClassificationCacheRepository,
    private readonly productRepo: IProductRepository,
  ) {}

  async classify(rawText: string): Promise<ClassificationResult> {
    const normalized = normalizeHebrewText(rawText);

    const cached = await this.cacheRepo.get(normalized);
    if (cached) return { ...cached, rawText };

    const products = await this.productRepo.findAllActive();
    const result = await this.runLayers(rawText, normalized, products);
    await this.cacheRepo.set(normalized, result);
    return result;
  }

  async classifyBatch(rawTexts: string[]): Promise<ClassificationResult[]> {
    const results: ClassificationResult[] = new Array(rawTexts.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < rawTexts.length) {
        const index = cursor++;
        results[index] = await this.classify(rawTexts[index]);
      }
    };

    const concurrency = Math.min(BATCH_CONCURRENCY, rawTexts.length);
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  private async runLayers(
    rawText: string,
    normalized: string,
    products: Product[],
  ): Promise<ClassificationResult> {
    for (const layer of this.layers) {
      const match = await layer.classify(rawText, { normalized, products });
      if (match && match.confidence >= layer.acceptThreshold) {
        return {
          rawText,
          matchedProductId: match.productId,
          confidence: match.confidence,
          source: layer.name,
          alternativeMatches: match.alternatives,
        };
      }
    }
    return { rawText, confidence: 0, source: "unresolved" };
  }
}
