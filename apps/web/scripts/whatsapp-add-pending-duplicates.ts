import "./env";
import { neon } from "@neondatabase/serverless";

/**
 * One-off: adds whatsapp_links.pending_duplicates (the bot's "already on the
 * list - add to the quantity?" question). Additive and safe to re-run.
 * Run from apps/web:  npx tsx scripts/whatsapp-add-pending-duplicates.ts
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  await sql.query(
    `ALTER TABLE "whatsapp_links" ADD COLUMN IF NOT EXISTS "pending_duplicates" jsonb DEFAULT '[]'::jsonb NOT NULL`,
  );
  console.log("✓ whatsapp_links.pending_duplicates is in place");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
