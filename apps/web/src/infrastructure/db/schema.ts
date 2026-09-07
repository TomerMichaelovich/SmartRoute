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
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { RouteStop } from "@smartroute/core/domain/entities/route";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { ShoppingTripItem } from "@smartroute/core/domain/entities/shopping-trip";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    // Always stored lowercased + trimmed, so a unique index gives us
    // case-insensitive uniqueness without a citext column.
    email: text("email").notNull(),
    // Null for accounts created purely via an OAuth provider (Google) that
    // have never set a password.
    passwordHash: text("password_hash"),
    displayName: text("display_name").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("oauth_accounts_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
    index("oauth_accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    // Only the SHA-256 of the opaque session token is stored; the raw token
    // lives solely in the user's httpOnly cookie. Lookup is by hash.
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ],
);

export const households = pgTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(), // "owner" | "member"
    status: text("status").notNull(), // "active" | "pending"
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("household_members_household_user_idx").on(table.householdId, table.userId),
    index("household_members_user_id_idx").on(table.userId),
  ],
);

export const householdInvites = pgTable(
  "household_invites",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id").notNull(),
    code: text("code").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    revokedAt: timestamp("revoked_at", { mode: "string" }),
  },
  (table) => [uniqueIndex("household_invites_code_idx").on(table.code)],
);

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
    // Ownership. All null => an anonymous guest list (looked up only by
    // shareCode). ownerUserId set => a registered user's personal list.
    // householdId set => a shared household list (wired in a later phase).
    ownerUserId: text("owner_user_id"),
    householdId: text("household_id"),
    // User-facing name; null falls back to a generated default in the UI.
    name: text("name"),
    // The one list surfaced as "active" for its owner/household. At most one
    // active per owner is enforced in the repository, not by a DB constraint.
    isActive: boolean("is_active").notNull().default(false),
    // Soft delete - rows are never hard-deleted so completed shopping trips
    // that reference a list id stay resolvable.
    deletedAt: timestamp("deleted_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("shopping_lists_store_id_idx").on(table.storeId),
    uniqueIndex("shopping_lists_share_code_idx").on(table.shareCode),
    index("shopping_lists_owner_user_id_idx").on(table.ownerUserId),
    index("shopping_lists_household_id_idx").on(table.householdId),
  ],
);

export const shoppingTrips = pgTable(
  "shopping_trips",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    householdId: text("household_id"),
    storeId: text("store_id").notNull(),
    storeName: text("store_name").notNull(),
    routeId: text("route_id"),
    shoppingListId: text("shopping_list_id"),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }).notNull(),
    items: jsonb("items").notNull().$type<ShoppingTripItem[]>(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    index("shopping_trips_user_id_idx").on(table.userId),
    index("shopping_trips_household_id_idx").on(table.householdId),
    // One trip per route; the recorder is safe to call more than once.
    uniqueIndex("shopping_trips_route_id_idx").on(table.routeId),
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
