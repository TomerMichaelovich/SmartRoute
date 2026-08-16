import { ClassificationService } from "@/src/application/classification/classification-service";
import { dictionaryLayer } from "@/src/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@/src/application/classification/layers/fuzzy-match-layer";
import { createLlmFallbackLayer } from "@/src/application/classification/layers/llm-fallback-layer";
import { normalizationLayer } from "@/src/application/classification/layers/normalization-layer";
import { AnthropicClassifier } from "./llm/anthropic-classifier";
import { JsonAnalyticsRepository } from "./repositories/json/json-analytics-repository";
import { JsonClassificationCacheRepository } from "./repositories/json/json-classification-cache-repository";
import { JsonEdgeRepository } from "./repositories/json/json-edge-repository";
import { JsonNodeRepository } from "./repositories/json/json-node-repository";
import { JsonProductListingRepository } from "./repositories/json/json-product-listing-repository";
import { JsonProductRepository } from "./repositories/json/json-product-repository";
import { JsonPromotionRepository } from "./repositories/json/json-promotion-repository";
import { JsonRouteRepository } from "./repositories/json/json-route-repository";
import { JsonShoppingListRepository } from "./repositories/json/json-shopping-list-repository";
import { JsonStoreRepository } from "./repositories/json/json-store-repository";

/**
 * Composition root: the single place infrastructure implementations are
 * wired to the interfaces the application layer depends on. Migrating off
 * local JSON files (e.g. to SQLite/Supabase) means swapping the repository
 * instances constructed here - no application/presentation code changes.
 */
export const storeRepository = new JsonStoreRepository();
export const nodeRepository = new JsonNodeRepository();
export const edgeRepository = new JsonEdgeRepository();
export const productRepository = new JsonProductRepository();
export const productListingRepository = new JsonProductListingRepository();
export const shoppingListRepository = new JsonShoppingListRepository();
export const routeRepository = new JsonRouteRepository();
export const promotionRepository = new JsonPromotionRepository();
export const classificationCacheRepository = new JsonClassificationCacheRepository();
export const analyticsRepository = new JsonAnalyticsRepository();

const llmClassifier = new AnthropicClassifier();

export const classificationService = new ClassificationService(
  [dictionaryLayer, normalizationLayer, fuzzyMatchLayer, createLlmFallbackLayer(llmClassifier)],
  classificationCacheRepository,
  productRepository,
);
