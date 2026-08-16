import "./env";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/src/infrastructure/db/client";
import {
  analyticsEvents,
  classificationCache,
  mapEdges,
  mapNodes,
  productListings,
  products,
  promotions,
  routes,
  shoppingLists,
  stores,
} from "@/src/infrastructure/db/schema";
import {
  analyticsEventSchema,
  classificationResultSchema,
  mapEdgeSchema,
  mapNodeSchema,
  productListingSchema,
  productSchema,
  promotionSchema,
  routeSchema,
  shoppingListSchema,
  storeSchema,
} from "@/src/infrastructure/repositories/schemas";
import type { PgTable } from "drizzle-orm/pg-core";
import type { ZodType } from "zod";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonArray(fileName: string): Promise<unknown[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf-8").catch(() => "[]");
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : [];
  if (!Array.isArray(parsed)) throw new Error(`${fileName}: expected a JSON array`);
  return parsed;
}

async function migrateCollection<T>(
  fileName: string,
  table: PgTable,
  schema: ZodType<T>,
): Promise<void> {
  const rows = (await readJsonArray(fileName)).map((row) => schema.parse(row));
  if (rows.length === 0) {
    console.log(`${fileName}: nothing to migrate`);
    return;
  }
  await db.insert(table).values(rows as Record<string, unknown>[]);
  console.log(`${fileName}: migrated ${rows.length} row(s)`);
}

async function migrateClassificationCache(): Promise<void> {
  const raw = await fs
    .readFile(path.join(DATA_DIR, "classification-cache.json"), "utf-8")
    .catch(() => "{}");
  const parsed: unknown = raw.trim() ? JSON.parse(raw) : {};
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("classification-cache.json: expected a JSON object");
  }
  const entries = Object.entries(parsed as Record<string, unknown>).map(
    ([normalizedKey, value]) => ({
      normalizedKey,
      result: classificationResultSchema.parse(value),
    }),
  );
  if (entries.length === 0) {
    console.log("classification-cache.json: nothing to migrate");
    return;
  }
  await db.insert(classificationCache).values(entries);
  console.log(`classification-cache.json: migrated ${entries.length} row(s)`);
}

async function migrateAnalyticsEvents(): Promise<void> {
  const raw = await fs
    .readFile(path.join(DATA_DIR, "analytics-events.jsonl"), "utf-8")
    .catch(() => "");
  const rows = raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => analyticsEventSchema.parse(JSON.parse(line)));
  if (rows.length === 0) {
    console.log("analytics-events.jsonl: nothing to migrate");
    return;
  }
  await db.insert(analyticsEvents).values(rows);
  console.log(`analytics-events.jsonl: migrated ${rows.length} row(s)`);
}

async function main() {
  await migrateCollection("stores.json", stores, storeSchema);
  await migrateCollection("nodes.json", mapNodes, mapNodeSchema);
  await migrateCollection("edges.json", mapEdges, mapEdgeSchema);
  await migrateCollection("products.json", products, productSchema);
  await migrateCollection("product-listings.json", productListings, productListingSchema);
  await migrateCollection("shopping-lists.json", shoppingLists, shoppingListSchema);
  await migrateCollection("routes.json", routes, routeSchema);
  await migrateCollection("promotions.json", promotions, promotionSchema);
  await migrateClassificationCache();
  await migrateAnalyticsEvents();
  console.log("Migration to Postgres complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exitCode = 1;
});
