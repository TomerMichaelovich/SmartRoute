import "./env";
import { neon } from "@neondatabase/serverless";

/**
 * One-off: adds whatsapp_links.pending_state (a question the bot is waiting on,
 * e.g. "which items were missing?"). Additive and safe to re-run.
 * Run from apps/web:  npx tsx scripts/whatsapp-add-pending-state.ts
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  await sql.query(`ALTER TABLE "whatsapp_links" ADD COLUMN IF NOT EXISTS "pending_state" jsonb`);
  console.log("✓ whatsapp_links.pending_state is in place");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
