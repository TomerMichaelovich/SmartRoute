-- Department floor areas drawn in the admin map editor (map_nodes.area in src/infrastructure/db/schema.ts).
-- `npm run db:push` only reaches the dev branch: run this once in the Neon SQL
-- Editor against production BEFORE deploying the code that reads it. Safe to re-run.

ALTER TABLE "map_nodes" ADD COLUMN IF NOT EXISTS "area" jsonb;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'map_nodes' ORDER BY ordinal_position;
