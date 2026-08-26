import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import type { RouteStop } from "@/src/domain/entities/route";
import type { ShoppingListItem } from "@/src/domain/entities/shopping-list";

export const stores = pgTable("stores", {
  id: text("id").primaryKey(),
  chainId: text("chain_id").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  mapImageUrl: text("map_image_url").notNull(),
  mapWidth: doublePrecision("map_width").notNull(),
  mapHeight: doublePrecision("map_height").notNull(),
  isActive: boolean("is_active").notNull(),
  promotionsEnabled: boolean("promotions_enabled").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
});

export const mapNodes = pgTable(
  "map_nodes",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    type: text("type").notNull(),
    label: text("label").notNull(),
    position: jsonb("position").notNull().$type<{ x: number; y: number }>(),
    zone: text("zone"),
    iconKey: text("icon_key"),
  },
  (table) => [index("map_nodes_store_id_idx").on(table.storeId)],
);

export const mapEdges = pgTable(
  "map_edges",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    fromNodeId: text("from_node_id").notNull(),
    toNodeId: text("to_node_id").notNull(),
    bidirectional: boolean("bidirectional").notNull(),
  },
  (table) => [index("map_edges_store_id_idx").on(table.storeId)],
);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  canonicalName: text("canonical_name").notNull(),
  aliases: jsonb("aliases").notNull().$type<string[]>(),
  normalizedAliases: jsonb("normalized_aliases").notNull().$type<string[]>(),
  category: text("category").notNull(),
  department: text("department").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull(),
});

export const productListings = pgTable(
  "product_listings",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    storeId: text("store_id").notNull(),
    nodeId: text("node_id").notNull(),
  },
  (table) => [
    index("product_listings_product_id_idx").on(table.productId),
    index("product_listings_store_id_idx").on(table.storeId),
  ],
);

export const shoppingLists = pgTable(
  "shopping_lists",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    items: jsonb("items").notNull().$type<ShoppingListItem[]>(),
    // Nullable: rows created before this feature simply have none and are only
    // ever looked up by id, never by code.
    shareCode: text("share_code"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("shopping_lists_store_id_idx").on(table.storeId),
    uniqueIndex("shopping_lists_share_code_idx").on(table.shareCode),
  ],
);

export const routes = pgTable(
  "routes",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    shoppingListId: text("shopping_list_id").notNull(),
    stops: jsonb("stops").notNull().$type<RouteStop[]>(),
    pathNodeIds: jsonb("path_node_ids").notNull().$type<string[]>(),
    checkoutPathNodeIds: jsonb("checkout_path_node_ids").notNull().$type<string[]>(),
    totalDistanceMeters: doublePrecision("total_distance_meters").notNull(),
    backtrackCount: integer("backtrack_count").notNull(),
    unresolvedItemIds: jsonb("unresolved_item_ids").notNull().$type<string[]>(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    index("routes_store_id_idx").on(table.storeId),
    index("routes_shopping_list_id_idx").on(table.shoppingListId),
  ],
);

export const promotions = pgTable(
  "promotions",
  {
    id: text("id").primaryKey(),
    chainId: text("chain_id").notNull(),
    storeId: text("store_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url"),
    attachedNodeId: text("attached_node_id").notNull(),
    isSponsored: boolean("is_sponsored").notNull(),
    isActive: boolean("is_active").notNull(),
    frequencyCapPerSession: integer("frequency_cap_per_session").notNull(),
    startDate: text("start_date"),
    endDate: text("end_date"),
  },
  (table) => [
    index("promotions_chain_id_idx").on(table.chainId),
    index("promotions_store_id_idx").on(table.storeId),
  ],
);

export const classificationCache = pgTable("classification_cache", {
  normalizedKey: text("normalized_key").primaryKey(),
  result: jsonb("result").notNull().$type<ClassificationResult>(),
});

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    sessionId: text("session_id").notNull(),
    storeId: text("store_id"),
    routeId: text("route_id"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  },
  (table) => [
    index("analytics_events_session_id_idx").on(table.sessionId),
    index("analytics_events_store_id_idx").on(table.storeId),
    index("analytics_events_route_id_idx").on(table.routeId),
  ],
);
