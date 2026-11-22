-- Departments marked as one physical shelf in the map editor. Additive only: old code
-- ignores this column. Run once in the Neon SQL Editor on the PRODUCTION branch BEFORE
-- deploying code that reads it (the new code selects it on every map load). Safe to re-run.

ALTER TABLE "map_nodes" ADD COLUMN IF NOT EXISTS "shelf_id" text;
