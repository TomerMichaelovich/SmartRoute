import { ClassificationService } from "@smartroute/core/application/classification/classification-service";
import { dictionaryLayer } from "@smartroute/core/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@smartroute/core/application/classification/layers/fuzzy-match-layer";
import { createLlmFallbackLayer } from "@smartroute/core/application/classification/layers/llm-fallback-layer";
import { normalizationLayer } from "@smartroute/core/application/classification/layers/normalization-layer";
import { AnthropicClassifier } from "./llm/anthropic-classifier";
import { PgAnalyticsRepository } from "./repositories/postgres/pg-analytics-repository";
import { PgClassificationCacheRepository } from "./repositories/postgres/pg-classification-cache-repository";
import { PgEdgeRepository } from "./repositories/postgres/pg-edge-repository";
import { PgHouseholdRepository } from "./repositories/postgres/pg-household-repository";
import { PgNodeRepository } from "./repositories/postgres/pg-node-repository";
import { PgProductListingRepository } from "./repositories/postgres/pg-product-listing-repository";
import { PgProductRepository } from "./repositories/postgres/pg-product-repository";
import { PgPromotionRepository } from "./repositories/postgres/pg-promotion-repository";
import { PgRouteRepository } from "./repositories/postgres/pg-route-repository";
import { PgSessionRepository } from "./repositories/postgres/pg-session-repository";
import { PgShoppingListRepository } from "./repositories/postgres/pg-shopping-list-repository";
import { PgShoppingTripRepository } from "./repositories/postgres/pg-shopping-trip-repository";
import { PgStoreRepository } from "./repositories/postgres/pg-store-repository";
import { PgUserRepository } from "./repositories/postgres/pg-user-repository";

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
export const shoppingTripRepository = new PgShoppingTripRepository();
export const routeRepository = new PgRouteRepository();
export const promotionRepository = new PgPromotionRepository();
export const classificationCacheRepository = new PgClassificationCacheRepository();
export const analyticsRepository = new PgAnalyticsRepository();
export const userRepository = new PgUserRepository();
export const sessionRepository = new PgSessionRepository();
export const householdRepository = new PgHouseholdRepository();

const llmClassifier = new AnthropicClassifier();

export const classificationService = new ClassificationService(
  [dictionaryLayer, normalizationLayer, fuzzyMatchLayer, createLlmFallbackLayer(llmClassifier)],
  classificationCacheRepository,
  productRepository,
);
