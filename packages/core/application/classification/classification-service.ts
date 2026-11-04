import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { IClassificationCacheRepository } from "@smartroute/core/application/ports/classification-cache-repository";
import type { IImportedAliasRepository } from "@smartroute/core/application/ports/imported-alias-repository";
import type { IProductRepository } from "@smartroute/core/application/ports/product-repository";
import type { ClassificationLayer } from "./classification-layer.interface";
import type { ImportedAliasIndex } from "./imported-aliases";
import { scoreCandidates } from "./layers/fuzzy-match-layer";
import { normalizeHebrewText } from "./normalize-hebrew-text";

const BATCH_CONCURRENCY = 5;
const MAX_UNRESOLVED_SUGGESTIONS = 3;
/** Cached outcomes the catalog may since have answered better: re-checked on every read. */
const RECHECKED = new Set<ClassificationResult["source"]>(["unresolved", "fuzzy", "alias"]);

/**
 * Orchestrates the classification pipeline: dictionary -> normalization ->
 * imported products' aliases -> fuzzy -> LLM fallback, in the order the layers
 * are supplied, against the whole shared master product catalog - matching text
 * to a product is a global
 * question with one right answer, not a per-store one, so every outcome
 * (including "unresolved") is cached by normalized text alone, app-wide; a cached
 * "unresolved" is re-checked against the (growing) catalog by the local layers,
 * but the LLM runs only once per text. Whether the matched product is actually carried by
 * the requesting store is a separate, per-request concern - see
 * resolveAvailability().
 */
export class ClassificationService {
  constructor(
    private readonly layers: ClassificationLayer[],
    private readonly cacheRepo: IClassificationCacheRepository,
    private readonly productRepo: IProductRepository,
    /** The aliases of products imported from price files (see imported-aliases); none without it. */
    private readonly aliasRepo?: IImportedAliasRepository,
  ) {}

  async classify(rawText: string): Promise<ClassificationResult> {
    const normalized = normalizeHebrewText(rawText);

    const cached = await this.cacheRepo.get(normalized);
    if (cached && !RECHECKED.has(cached.source)) return { ...cached, rawText };

    // The hand-made catalog only: a line names a kind of product ("יוגורט"), and the
    // answer is cached for everyone. Which of a branch's thousands of imported
    // products it means is decided per branch, when routing (place-choice).
    const [products, aliases] = await Promise.all([this.productRepo.findCatalog(), this.aliasRepo?.aliasIndex()]);
    if (cached) {
      // A cached "unresolved", fuzzy guess or imported alias isn't final: the catalog
      // grows, and a text nothing matched yesterday ("פתיתים") may be an alias today
      // ("שוקו" was guessed as "שוקולד חלב" before "שוקו" existed; "ג'ין" is the generic
      // product's once there is one). Re-run the cheap local layers; the LLM layer still
      // runs only once per text (a fuzzy or alias hit never reached it).
      const retry = await this.runLayers(rawText, normalized, products, aliases, (layer) => layer.name !== "llm" || cached.source !== "unresolved");
      if (retry.source === "unresolved" && cached.source === "unresolved") return { ...cached, rawText };
      if (
        retry.matchedProductId !== cached.matchedProductId ||
        retry.matchedAlias !== cached.matchedAlias ||
        retry.source !== cached.source
      ) {
        await this.cacheRepo.set(normalized, retry);
      }
      return retry;
    }
    const result = await this.runLayers(rawText, normalized, products, aliases);
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
    aliases: ImportedAliasIndex | undefined,
    include: (layer: ClassificationLayer) => boolean = () => true,
  ): Promise<ClassificationResult> {
    for (const layer of this.layers.filter(include)) {
      const match = await layer.classify(rawText, { normalized, products, aliases });
      if (!match || match.confidence < layer.acceptThreshold) continue;
      if (match.alias) {
        return {
          rawText,
          matchedAlias: match.alias.text,
          ...(match.alias.department ? { department: match.alias.department } : {}),
          ...(match.alias.category ? { category: match.alias.category } : {}),
          confidence: match.confidence,
          source: layer.name,
        };
      }
      return {
        rawText,
        matchedProductId: match.productId,
        confidence: match.confidence,
        source: layer.name,
        alternativeMatches: match.alternatives,
      };
    }
    // No layer cleared its accept threshold - still surface the closest catalog
    // candidates (regardless of threshold) so Classification Review can offer them
    // as quick suggestions instead of forcing the shopper to search the full catalog.
    const suggestions = scoreCandidates(normalized, products).slice(0, MAX_UNRESOLVED_SUGGESTIONS);
    return {
      rawText,
      confidence: 0,
      source: "unresolved",
      alternativeMatches: suggestions.length > 0 ? suggestions : undefined,
    };
  }
}
