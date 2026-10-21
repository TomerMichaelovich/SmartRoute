-- Price-transparency tables for the cheapest-basket feature (additive only).
-- Run once in the Neon SQL Editor on the PRODUCTION branch. Safe to re-run.
-- Generated from apps/web/src/infrastructure/db/schema.ts via `drizzle-kit export`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "retail_chains" (
	"id" text PRIMARY KEY NOT NULL,
	"gov_chain_id" text NOT NULL,
	"name" text NOT NULL,
	"portal" text NOT NULL,
	"portal_config" jsonb NOT NULL,
	"navio_chain_id" text,
	"is_enabled" boolean NOT NULL,
	"updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "retail_branches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "retail_branches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chain_id" text NOT NULL,
	"store_code" text NOT NULL,
	"sub_chain_id" text,
	"sub_chain_name" text,
	"name" text NOT NULL,
	"address" text,
	"city_raw" text,
	"city_code" integer,
	"lat" double precision,
	"lng" double precision,
	"geocode_status" text DEFAULT 'pending' NOT NULL,
	"geocoded_address" text,
	"navio_store_id" text,
	"is_retail" boolean DEFAULT true NOT NULL,
	"prices_enabled" boolean DEFAULT false NOT NULL,
	"price_file_at" timestamp,
	"prices_updated_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "retail_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "retail_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_key" text NOT NULL,
	"item_code" text NOT NULL,
	"chain_id" text,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"manufacturer" text,
	"quantity" double precision,
	"unit_qty" text,
	"unit_of_measure" text,
	"is_weighted" boolean NOT NULL,
	"branch_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "branch_prices" (
	"branch_id" integer NOT NULL,
	"retail_item_id" integer NOT NULL,
	"price_agorot" integer NOT NULL,
	"unit_price_agorot" integer,
	"price_updated_at" timestamp,
	CONSTRAINT "branch_prices_branch_id_retail_item_id_pk" PRIMARY KEY("branch_id","retail_item_id")
);

CREATE TABLE IF NOT EXISTS "product_sku_links" (
	"product_id" text NOT NULL,
	"item_key" text NOT NULL,
	"source" text NOT NULL,
	"score" real NOT NULL,
	"is_typical" boolean DEFAULT false NOT NULL,
	"is_rejected" boolean DEFAULT false NOT NULL,
	"variant_label" text,
	"updated_at" timestamp NOT NULL,
	CONSTRAINT "product_sku_links_product_id_item_key_pk" PRIMARY KEY("product_id","item_key")
);

CREATE TABLE IF NOT EXISTS "price_ingest_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"mode" text NOT NULL,
	"chain_id" text NOT NULL,
	"status" text NOT NULL,
	"files" integer DEFAULT 0 NOT NULL,
	"rows_upserted" integer DEFAULT 0 NOT NULL,
	"rows_deleted" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp
);

CREATE INDEX IF NOT EXISTS "price_ingest_runs_started_at_idx" ON "price_ingest_runs" USING btree ("started_at");
CREATE INDEX IF NOT EXISTS "product_sku_links_item_key_idx" ON "product_sku_links" USING btree ("item_key");
CREATE UNIQUE INDEX IF NOT EXISTS "retail_branches_chain_store_idx" ON "retail_branches" USING btree ("chain_id","store_code");
CREATE UNIQUE INDEX IF NOT EXISTS "retail_branches_navio_store_id_idx" ON "retail_branches" USING btree ("navio_store_id");
CREATE INDEX IF NOT EXISTS "retail_branches_city_code_idx" ON "retail_branches" USING btree ("city_code");
CREATE UNIQUE INDEX IF NOT EXISTS "retail_chains_gov_chain_id_idx" ON "retail_chains" USING btree ("gov_chain_id");
CREATE UNIQUE INDEX IF NOT EXISTS "retail_items_item_key_idx" ON "retail_items" USING btree ("item_key");
CREATE INDEX IF NOT EXISTS "retail_items_normalized_name_trgm_idx" ON "retail_items" USING gin ("normalized_name" gin_trgm_ops);

COMMIT;

-- Check: should list the 6 tables.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('retail_chains', 'retail_branches', 'retail_items', 'branch_prices', 'product_sku_links', 'price_ingest_runs');
