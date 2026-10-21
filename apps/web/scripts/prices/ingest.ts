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
  for (const chain of chains) {
    const started = Date.now();
    try {
      if (mode !== "prices") await ingestStores(sql, chain, { dryRun });
      if (mode !== "stores") await ingestPrices(sql, chain, { dryRun, force, storeCodes });
      console.log(`${chain.id}: done in ${Math.round((Date.now() - started) / 1000)}s`);
    } catch (e) {
      failures.push(chain.id);
      console.error(`${chain.id}: FAILED — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!dryRun && mode !== "stores") await refreshBranchCounts(sql);
  if (failures.length) {
    console.error(`failed chains: ${failures.join(", ")}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
