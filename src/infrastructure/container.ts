import { ClassificationService } from "@/src/application/classification/classification-service";
import { dictionaryLayer } from "@/src/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@/src/application/classification/layers/fuzzy-match-layer";
import { createLlmFallbackLayer } from "@/src/application/classification/layers/llm-fallback-layer";
import { normalizationLayer } from "@/src/application/classification/layers/normalization-layer";
import { AnthropicClassifier } from "./llm/anthropic-classifier";
import { PgAnalyticsRepository } from "./repositories/postgres/pg-analytics-repository";
import { PgClassificationCacheRepository } from "./repositories/postgres/pg-classification-cache-repository";
import { PgEdgeRepository } from "./repositories/postgres/pg-edge-repository";
import { PgNodeRepository } from "./repositories/postgres/pg-node-repository";
import { PgProductListingRepository } from "./repositories/postgres/pg-product-listing-repository";
import { PgProductRepository } from "./repositories/postgres/pg-product-repository";
import { PgPromotionRepository } from "./repositories/postgres/pg-promotion-repository";
import { PgRouteRepository } from "./repositories/postgres/pg-route-repository";
import { PgShoppingListRepository } from "./repositories/postgres/pg-shopping-list-repository";
import { PgStoreRepository } from "./repositories/postgres/pg-store-repository";

/**
 * Composition root: the single place infrastructure implementations are
 * wired to the interfaces the application layer depends on. Swapping
 * persistence backends means swapping the repository instances constructed
 * here - no application/presentation code changes.
 */
export const storeRepository = new PgStoreRepository();
export const nodeRepository = new PgNodeRepository();
export const edgeRepository = new PgEdgeRepository();
export const productRepository = new PgProductRepository();
export const productListingRepository = new PgProductListingRepository();
export const shoppingListRepository = new PgShoppingListRepository();
export const routeRepository = new PgRouteRepository();
export const promotionRepository = new PgPromotionRepository();
export const classificationCacheRepository = new PgClassificationCacheRepository();
export const analyticsRepository = new PgAnalyticsRepository();

const llmClassifier = new AnthropicClassifier();

export const classificationService = new ClassificationService(
  [dictionaryLayer, normalizationLayer, fuzzyMatchLayer, createLlmFallbackLayer(llmClassifier)],
  classificationCacheRepository,
  productRepository,
);
