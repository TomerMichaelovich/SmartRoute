import { connect } from "./db";

/**
 * drizzle-kit push doesn't create extensions, and the retail_items trigram index
 * needs pg_trgm. Run once per database BEFORE `db:push`:
 *
 *   tsx scripts/prices/ensure-extensions.ts          -> dev branch
 *   tsx scripts/prices/ensure-extensions.ts --prod   -> production
 */
async function main() {
  const { sql, target } = connect();
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  const rows = await sql`SELECT extversion FROM pg_extension WHERE extname = 'pg_trgm'`;
  console.log(`[${target}] pg_trgm ${rows[0]?.extversion ?? "missing"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
