-- Products imported from price files (scripts/catalog), one per barcode. Additive only:
-- old code ignores these columns. Run once in the Neon SQL Editor on the PRODUCTION
-- branch before deploying code that reads them. Safe to re-run.

BEGIN;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_item_key" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shelf_group" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manually_edited" boolean DEFAULT false NOT NULL;

-- The first version (2026-10-27) indexed per chain; products are per barcode now.
DROP INDEX IF EXISTS "products_chain_source_item_key_idx";
DROP INDEX IF EXISTS "products_chain_shelf_group_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "products_source_item_key_idx"
  ON "products" USING btree ("source_item_key") WHERE "products"."source_item_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "products_shelf_group_idx"
  ON "products" USING btree ("shelf_group");

COMMIT;
