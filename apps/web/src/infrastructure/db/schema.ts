import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
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

// People who log into the admin panel - separate from the app's `users`. The
// owner logs in with ADMIN_PASSWORD and needs no row here.
export const adminUsers = pgTable(
  "admin_users",
  {
    id: text("id").primaryKey(),
    // Lowercased + trimmed, like users.email.
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    // { sections: AdminSection[], storeIds: string[] } - see admin-permissions.ts.
    permissions: jsonb("permissions").notNull().$type<{ sections: string[]; storeIds: string[] }>(),
    isActive: boolean("is_active").notNull().default(true),
    // Part of the session token: bumping it (password reset) logs out every open session.
    sessionVersion: integer("session_version").notNull().default(1),
    lastLoginAt: timestamp("last_login_at", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("admin_users_username_idx").on(table.username)],
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

/**
 * Expo push tokens of signed-in mobile devices, used to send silent
 * "list changed" pushes that refresh the home-screen widget of a shared
 * list's other participants. One row per device; a device that signs into
 * another account moves its row to that user.
 */
/** One row per photo read by the OCR endpoint - counts against the user's daily quota. */
export const ocrRequests = pgTable(
  "ocr_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [index("ocr_requests_user_created_idx").on(table.userId, table.createdAt)],
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("push_tokens_token_idx").on(table.token),
    index("push_tokens_user_id_idx").on(table.userId),
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

/** A WhatsApp number linked to a user and the one list the bot adds to for them. */
export const whatsappLinks = pgTable(
  "whatsapp_links",
  {
    id: text("id").primaryKey(),
    // WhatsApp's wa_id: the number in international format, digits only (972501234567).
    phone: text("phone").notNull(),
    userId: text("user_id").notNull(),
    listId: text("list_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    // Last message *from* this number. Replies are free only within 24h of it.
    lastInboundAt: timestamp("last_inbound_at", { mode: "string" }).notNull().defaultNow(),
    // Items this number's last message added - what "בטל" removes.
    lastAddedItemIds: jsonb("last_added_item_ids").$type<string[]>().notNull().default([]),
  },
  (table) => [
    uniqueIndex("whatsapp_links_phone_idx").on(table.phone),
    index("whatsapp_links_list_id_idx").on(table.listId),
  ],
);

/** One-time code the app hands out ("חיבור K7Q2MX") to link a WhatsApp number to a list. */
export const whatsappLinkCodes = pgTable(
  "whatsapp_link_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    userId: text("user_id").notNull(),
    listId: text("list_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    usedAt: timestamp("used_at", { mode: "string" }),
  },
  (table) => [uniqueIndex("whatsapp_link_codes_code_idx").on(table.code)],
);

/** WhatsApp message ids already handled - Meta may deliver the same webhook more than once. */
export const whatsappProcessedMessages = pgTable("whatsapp_processed_messages", {
  messageId: text("message_id").primaryKey(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
});

/**
 * A finished trip the WhatsApp bot hasn't turned into a fresh list yet. On the
 * next message to the bot the bought items are dropped, and if some weren't
 * bought it asks whether to carry them over. One row per list, removed once done.
 */
export const whatsappListResets = pgTable("whatsapp_list_resets", {
  listId: text("list_id").primaryKey(),
  tripItemIds: jsonb("trip_item_ids").$type<string[]>().notNull(),
  leftoverItemIds: jsonb("leftover_item_ids").$type<string[]>().notNull(),
  finishedAt: timestamp("finished_at", { mode: "string" }).notNull().defaultNow(),
  // Set once the bot has asked about the leftovers.
  askedAt: timestamp("asked_at", { mode: "string" }),
  // Items someone sent while the question was open - added once it's answered.
  pendingText: text("pending_text"),
});

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

/** The admin's walkable-floor mask for a store's map image (see packages/core/map/walkable). */
export const storeWalkableMasks = pgTable("store_walkable_masks", {
  storeId: text("store_id").primaryKey(),
  cols: integer("cols").notNull(),
  rows: integer("rows").notNull(),
  rle: jsonb("rle").notNull().$type<number[]>(),
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
  // Null = generic product; otherwise the one chain (stores.chain_id) selling it.
  chainId: text("chain_id"),
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
    // A standing list that survives finishing a trip (see ShoppingList.isPinned).
    isPinned: boolean("is_pinned").notNull().default(false),
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
    // Set server-side when the request carried a valid user session; null for
    // guests and for rows written before per-user attribution.
    userId: text("user_id"),
    storeId: text("store_id"),
    routeId: text("route_id"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>(),
    timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  },
  (table) => [
    index("analytics_events_session_id_idx").on(table.sessionId),
    index("analytics_events_store_id_idx").on(table.storeId),
    index("analytics_events_route_id_idx").on(table.routeId),
    index("analytics_events_user_id_idx").on(table.userId),
  ],
);

// ---------------------------------------------------------------------------
// Price transparency (חוק קידום התחרות בענף המזון). Chains publish Stores and
// PriceFull files per branch; scripts/prices ingests them for the pilot
// cities. These tables are independent of the NAVIO-mapped `stores`: a retail
// branch links to a mapped store only through `navio_store_id`.
//
// The high-volume tables use integer identity ids (branch_prices is the bulk of
// the data). Anything that must survive dev<->prod copies — SKU links, the
// variant saved on a list item — uses the stable `item_key` text instead.
// ---------------------------------------------------------------------------

export const retailChains = pgTable(
  "retail_chains",
  {
    // Slug, e.g. "shufersal", "rami-levy".
    id: text("id").primaryKey(),
    // The 13-digit ChainID the files carry, e.g. "7290027600007".
    govChainId: text("gov_chain_id").notNull(),
    name: text("name").notNull(),
    // Which portal adapter downloads this chain: "shufersal" | "cerberus" | "carrefour".
    portal: text("portal").notNull(),
    portalConfig: jsonb("portal_config").notNull().$type<Record<string, string>>(),
    // The matching stores.chain_id, when NAVIO has mapped stores of this chain.
    navioChainId: text("navio_chain_id"),
    isEnabled: boolean("is_enabled").notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [uniqueIndex("retail_chains_gov_chain_id_idx").on(table.govChainId)],
);

export const retailBranches = pgTable(
  "retail_branches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    chainId: text("chain_id").notNull(),
    // StoreID from the files, without leading zeros ("001" -> "1").
    storeCode: text("store_code").notNull(),
    subChainId: text("sub_chain_id"),
    subChainName: text("sub_chain_name"),
    name: text("name").notNull(),
    address: text("address"),
    // <City> as published: usually a CBS settlement code, sometimes a name, "0" or empty.
    cityRaw: text("city_raw"),
    // Resolved CBS settlement code. Comparison only ever happens within one city.
    cityCode: integer("city_code"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // "pending" | "ok" | "failed" | "manual"
    geocodeStatus: text("geocode_status").notNull().default("pending"),
    // The address+city string last geocoded; re-geocode only when it changes.
    geocodedAddress: text("geocoded_address"),
    navioStoreId: text("navio_store_id"),
    // False for wholesale / cash&carry branches that shouldn't be offered to shoppers.
    isRetail: boolean("is_retail").notNull().default(true),
    // In a pilot city: prices are ingested and the branch takes part in quotes.
    pricesEnabled: boolean("prices_enabled").notNull().default(false),
    // Timestamp parsed from the PriceFull file name last ingested.
    priceFileAt: timestamp("price_file_at", { mode: "string" }),
    pricesUpdatedAt: timestamp("prices_updated_at", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("retail_branches_chain_store_idx").on(table.chainId, table.storeCode),
    uniqueIndex("retail_branches_navio_store_id_idx").on(table.navioStoreId),
    index("retail_branches_city_code_idx").on(table.cityCode),
  ],
);

export const retailItems = pgTable(
  "retail_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // The barcode for packaged goods (shared across chains), or "<chainId>:<code>"
    // for chain-internal codes — weighted produce reuses 729000000xxxx codes that
    // mean different things at different chains.
    itemKey: text("item_key").notNull(),
    itemCode: text("item_code").notNull(),
    // Set only for chain-internal codes.
    chainId: text("chain_id"),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    manufacturer: text("manufacturer"),
    quantity: doublePrecision("quantity"),
    unitQty: text("unit_qty"),
    unitOfMeasure: text("unit_of_measure"),
    isWeighted: boolean("is_weighted").notNull(),
    // How many price-enabled branches carry it; ranks refinement options.
    branchCount: integer("branch_count").notNull().default(0),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    uniqueIndex("retail_items_item_key_idx").on(table.itemKey),
    // Needs `CREATE EXTENSION pg_trgm` (drizzle-kit push doesn't create extensions).
    index("retail_items_normalized_name_trgm_idx").using("gin", table.normalizedName.op("gin_trgm_ops")),
  ],
);

export const branchPrices = pgTable(
  "branch_prices",
  {
    branchId: integer("branch_id").notNull(),
    retailItemId: integer("retail_item_id").notNull(),
    priceAgorot: integer("price_agorot").notNull(),
    unitPriceAgorot: integer("unit_price_agorot"),
    priceUpdatedAt: timestamp("price_updated_at", { mode: "string" }),
  },
  (table) => [primaryKey({ columns: [table.branchId, table.retailItemId] })],
);

/** Which concrete SKUs a generic product ("חלב") can mean. Built offline by scripts/prices/link-skus. */
export const productSkuLinks = pgTable(
  "product_sku_links",
  {
    productId: text("product_id").notNull(),
    itemKey: text("item_key").notNull(),
    // "trgm" | "llm" | "manual"
    source: text("source").notNull(),
    score: real("score").notNull(),
    // The standard package a shopper means by default (1L milk, not 200ml chocolate milk).
    isTypical: boolean("is_typical").notNull().default(false),
    // Admin-rejected; kept so re-running the linker doesn't add it back.
    isRejected: boolean("is_rejected").notNull().default(false),
    variantLabel: text("variant_label"),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.productId, table.itemKey] }),
    index("product_sku_links_item_key_idx").on(table.itemKey),
  ],
);

export const priceIngestRuns = pgTable(
  "price_ingest_runs",
  {
    id: text("id").primaryKey(),
    // "stores" | "prices"
    mode: text("mode").notNull(),
    chainId: text("chain_id").notNull(),
    // "running" | "ok" | "failed"
    status: text("status").notNull(),
    files: integer("files").notNull().default(0),
    rowsUpserted: integer("rows_upserted").notNull().default(0),
    rowsDeleted: integer("rows_deleted").notNull().default(0),
    error: text("error"),
    startedAt: timestamp("started_at", { mode: "string" }).notNull(),
    finishedAt: timestamp("finished_at", { mode: "string" }),
  },
  (table) => [index("price_ingest_runs_started_at_idx").on(table.startedAt)],
);
