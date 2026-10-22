import { ingestPrices, ingestStores, refreshBranchCounts, upsertChains } from "@/src/infrastructure/prices/ingest";
import { PRICE_CHAINS } from "@/src/infrastructure/prices/pilot-config";
import { connect } from "./db";

/**
 * Price-transparency ingestion for the pilot chains/cities (pilot-config.ts).
 *
 * Usage: tsx scripts/prices/ingest.ts [--mode=full|stores|prices] [--chain=<id>[,<id>]]
 *                                     [--stores=<code>[,<code>]] [--force] [--dry-run] [--prod]
 *   --mode=stores  Stores files -> retail_branches (city, price-enabled flag)
 *   --mode=prices  newest PriceFull per price-enabled branch -> branch_prices (diff only)
 *   --mode=full    both (default)
 *   default target is the dev branch; --prod = production; CI uses $DATABASE_URL.
 *
 * Each chain runs in isolation: one portal failing doesn't stop the others, but
 * the process exits non-zero so the workflow run shows as failed.
 */

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const mode = arg("mode") ?? "full";
  if (!["full", "stores", "prices"].includes(mode)) throw new Error(`unknown --mode=${mode}`);
  const chainIds = arg("chain")?.split(",");
  const storeCodes = arg("stores")?.split(",");
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const chains = PRICE_CHAINS.filter((c) => !chainIds || chainIds.includes(c.id));
  if (chains.length === 0) throw new Error(`no chain matches --chain=${chainIds}`);

  const { sql, target } = connect();
  console.log(`[${target}] mode=${mode}${dryRun ? " (dry run)" : ""} chains=${chains.map((c) => c.id).join(",")}`);
  await upsertChains(sql, chains, dryRun);

  const failures: string[] = [];
  const attempt = async (chain: (typeof chains)[number], step: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      failures.push(`${chain.id} ${step}: ${reason}`);
      console.error(`${chain.id}: ${step} FAILED — ${reason}`);
      // A one-off portal hiccup is a warning, not a failed run (see the staleness check below).
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=${chain.id} ${step} failed::${reason}`);
    }
  };
  for (const chain of chains) {
    const started = Date.now();
    // Independent steps: a slow Stores listing mustn't keep that chain's prices from updating.
    if (mode !== "prices") await attempt(chain, "stores", () => ingestStores(sql, chain, { dryRun }));
    if (mode !== "stores") await attempt(chain, "prices", () => ingestPrices(sql, chain, { dryRun, force, storeCodes }));
    console.log(`${chain.id}: done in ${Math.round((Date.now() - started) / 1000)}s`);
  }
  if (!dryRun && mode !== "stores") await refreshBranchCounts(sql);
  if (failures.length) console.error(`failures:\n  ${failures.join("\n  ")}`);
  if (dryRun) return;

  // Fail the run only for a lasting problem: a chain whose newest prices are
  // older than STALE_AFTER_HOURS (quotes drop branches at MAX_PRICE_FILE_AGE_HOURS).
  const stale = (await sql.query(
    `SELECT chain_id, to_char(max(price_file_at), 'YYYY-MM-DD HH24:MI') AS newest
     FROM retail_branches WHERE prices_enabled AND is_active AND chain_id = ANY($1::text[])
     GROUP BY chain_id
     HAVING max(price_file_at) IS NULL
         OR max(price_file_at) < (now() AT TIME ZONE 'Asia/Jerusalem') - make_interval(hours => $2)`,
    [chains.map((c) => c.id), STALE_AFTER_HOURS],
  )) as { chain_id: string; newest: string | null }[];
  if (stale.length) {
    for (const s of stale) console.error(`STALE: ${s.chain_id} newest prices ${s.newest ?? "never"}`);
    process.exit(1);
  }
}

/** Newer than the quote cut-off (72h), so a failing chain is flagged a day before it drops out. */
const STALE_AFTER_HOURS = 48;

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
