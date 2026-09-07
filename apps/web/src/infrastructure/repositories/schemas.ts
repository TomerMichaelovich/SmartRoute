import { z } from "zod";

// Maps a `users` row to the domain User (drops passwordHash - never leaves
// the infrastructure layer).
export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  createdAt: z.string(),
});

export const householdRoleSchema = z.enum(["owner", "member"]);
export const membershipStatusSchema = z.enum(["active", "pending"]);

export const householdSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
});

export const householdMembershipSchema = z.object({
  householdId: z.string(),
  userId: z.string(),
  role: householdRoleSchema,
  status: membershipStatusSchema,
  createdAt: z.string(),
});

export const householdInviteSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  code: z.string(),
  createdBy: z.string(),
  createdAt: z.string(),
  expiresAt: z.string(),
  revokedAt: z.string().nullable(),
});

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

export const mapNodeTypeSchema = z.enum(["entrance", "checkout", "waypoint", "department"]);

export const mapNodeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  type: mapNodeTypeSchema,
  label: z.string(),
  position: geoPointSchema,
  zone: z.string().optional(),
  iconKey: z.string().optional(),
});

export const mapEdgeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
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

export const productSchema = z.object({
  id: z.string(),
  canonicalName: z.string(),
  aliases: z.array(z.string()),
  normalizedAliases: z.array(z.string()),
  category: productCategorySchema,
  department: z.string(),
  imageUrl: z.string().optional(),
  isActive: z.boolean(),
});

export const productListingSchema = z.object({
  id: z.string(),
  productId: z.string(),
  storeId: z.string(),
  nodeId: z.string(),
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
  availableAtStore: z.boolean().optional(),
});

export const shoppingListItemSchema = z.object({
  id: z.string(),
  rawText: z.string(),
  quantity: z.number().optional(),
  classification: classificationResultSchema.optional(),
  checked: z.boolean().optional(),
  checkedByUserId: z.string().optional(),
  checkedByName: z.string().optional(),
  checkedAt: z.string().optional(),
  notFound: z.boolean().optional(),
  addedByUserId: z.string().optional(),
});

export const shoppingListSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  items: z.array(shoppingListItemSchema),
  shareCode: z.string().nullable(),
  // `.default()` so pre-Phase-2 JSON fixtures (used by the one-off
  // migrate-to-postgres script) still validate; live DB rows always carry
  // the columns explicitly.
  ownerUserId: z.string().nullable().default(null),
  householdId: z.string().nullable().default(null),
  name: z.string().nullable().default(null),
  isActive: z.boolean().default(false),
  deletedAt: z.string().nullable().default(null),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const shoppingTripItemSchema = z.object({
  rawText: z.string(),
  quantity: z.number().optional(),
  productName: z.string().nullable(),
  collected: z.boolean(),
  notFound: z.boolean(),
});

export const shoppingTripSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  householdId: z.string().nullable(),
  storeId: z.string(),
  storeName: z.string(),
  routeId: z.string().nullable(),
  shoppingListId: z.string().nullable(),
  startedAt: z.string(),
  completedAt: z.string(),
  items: z.array(shoppingTripItemSchema),
  createdAt: z.string(),
});

export const routeStopSchema = z.object({
  order: z.number(),
  nodeId: z.string(),
  itemIds: z.array(z.string()),
  label: z.string(),
  type: mapNodeTypeSchema,
  pathFromPrevious: z.array(z.string()),
  pathToCheckout: z.array(z.string()),
});

export const routeSchema = z.object({
  id: z.string(),
  storeId: z.string(),
  shoppingListId: z.string(),
  stops: z.array(routeStopSchema),
  pathNodeIds: z.array(z.string()),
  checkoutPathNodeIds: z.array(z.string()),
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
  "item_not_found",
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
