import "./env";
import { neon } from "@neondatabase/serverless";

/**
 * One-off for a database that missed main's November schema changes (the price-file
 * catalog import): products.source_item_key / shelf_group / manually_edited, their
 * indexes, and the store_excluded_products table. Additive only, safe to re-run.
 * Run from apps/web:  npx tsx scripts/sync-main-schema-2026-11.ts
 */
const STATEMENTS = [
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_item_key" text`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shelf_group" text`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manually_edited" boolean DEFAULT false NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "products_source_item_key_idx" ON "products" USING btree ("source_item_key") WHERE "products"."source_item_key" IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS "products_shelf_group_idx" ON "products" USING btree ("shelf_group")`,
  `CREATE TABLE IF NOT EXISTS "store_excluded_products" (
    "store_id" text NOT NULL,
    "product_id" text NOT NULL,
    "created_at" timestamp NOT NULL,
    CONSTRAINT "store_excluded_products_store_id_product_id_pk" PRIMARY KEY("store_id","product_id")
  )`,
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  for (const statement of STATEMENTS) await sql.query(statement);
  console.log("✓ products columns + store_excluded_products are in place");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
