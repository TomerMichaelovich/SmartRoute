-- Admin-panel users and permissions (admin_users in src/infrastructure/db/schema.ts).
-- `npm run db:push` only reaches the dev branch: run this once in the Neon SQL
-- Editor against production BEFORE deploying the code that reads it. Safe to re-run.

CREATE TABLE IF NOT EXISTS "admin_users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"session_version" integer DEFAULT 1 NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_username_idx" ON "admin_users" USING btree ("username");

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'admin_users' ORDER BY ordinal_position;
