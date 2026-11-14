-- Videos pinned on a store's map in the admin editor (store_map_videos in src/infrastructure/db/schema.ts).
-- `npm run db:push` only reaches the dev branch: run this once in the Neon SQL
-- Editor against production BEFORE deploying the code that reads it. Safe to re-run.

CREATE TABLE IF NOT EXISTS "store_map_videos" (
	"id" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"position" jsonb NOT NULL,
	"title" text NOT NULL,
	"video_url" text NOT NULL,
	"created_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "store_map_videos_store_id_idx" ON "store_map_videos" USING btree ("store_id");

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'store_map_videos' ORDER BY ordinal_position;
