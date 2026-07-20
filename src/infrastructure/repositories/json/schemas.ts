import { z } from "zod";

export const geoPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const storeSchema = z.object({
  id: z.string(),
  chainId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  mapImageUrl: z.string(),
  mapWidth: z.number(),
  mapHeight: z.number(),
  isActive: z.boolean(),
  promotionsEnabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const mapNodeTypeSchema = z.enum([
  "entrance",
  "checkout",
  "aisle",
  "department",
  "intersection",
  "waypoint",
  "product_point",
]);

export const mapNodeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  type: mapNodeTypeSchema,
  label: z.string(),
  position: geoPointSchema,
  zone: z.string().optional(),
});

export const mapEdgeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  distanceMeters: z.number(),
  bidirectional: z.boolean(),
});

export const productCategorySchema = z.enum([
  "produce",
  "bakery",
  "dairy",
  "meat_fish",
  "frozen",
  "pantry",
  "beverages",
  "snacks",
  "household",
  "personal_care",
  "other",
]);

export const productStoreLocationSchema = z.object({
  storeId: z.string(),
  nodeId: z.string(),
  shelf: z.string().optional(),
  zone: z.string().optional(),
});

export const productSchema = z.object({
  id: z.string(),
  chainId: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()),
  normalizedAliases: z.array(z.string()),
  category: productCategorySchema,
  department: z.string(),
  locations: z.array(productStoreLocationSchema),
  isActive: z.boolean(),
});

export const classificationSourceSchema = z.enum([
  "dictionary",
  "normalization",
  "fuzzy",
  "llm",
  "unresolved",
]);

export const classificationResultSchema = z.object({
  rawText: z.string(),
  matchedProductId: z.string().optional(),
  confidence: z.number(),
  source: classificationSourceSchema,
  alternativeMatches: z
    .array(z.object({ productId: z.string(), confidence: z.number() }))
    .optional(),
});

export const shoppingListItemSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  quantity: z.number().optional(),
  classification: classificationResultSchema.optional(),
});

export const shoppingListSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  items: z.array(shoppingListItemSchema),
  createdAt: z.string(),
});

export const routeStopSchema = z.object({
  order: z.number(),
  nodeId: z.string(),
  itemIds: z.array(z.string()),
  label: z.string(),
  type: mapNodeTypeSchema,
});

export const routeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  shoppingListId: z.string(),
  stops: z.array(routeStopSchema),
  pathNodeIds: z.array(z.string()),
  totalDistanceMeters: z.number(),
  backtrackCount: z.number(),
  unresolvedItemIds: z.array(z.string()),
  createdAt: z.string(),
});

export const promotionSchema = z.object({
  id: z.string(),
  chainId: z.string(),
  storeId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  imageUrl: z.string().optional(),
  attachedNodeId: z.string(),
  isSponsored: z.boolean(),
  isActive: z.boolean(),
  frequencyCapPerSession: z.number(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const analyticsEventTypeSchema = z.enum([
  "route_started",
  "route_completed",
  "route_abandoned",
  "item_classified",
  "item_checked",
  "classification_corrected",
  "promotion_impression",
  "promotion_click",
  "satisfaction_rating",
]);

export const analyticsEventSchema = z.object({
  id: z.string(),
  type: analyticsEventTypeSchema,
  sessionId: z.string(),
  storeId: z.string().optional(),
  routeId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()),
  timestamp: z.string(),
});
