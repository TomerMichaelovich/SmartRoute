import { inArray, sql as drizzleSql } from "drizzle-orm";
import { type EnrichedItem, planCatalogSync, validateEnrichment } from "@/src/infrastructure/catalog/catalog-import";
import { products, productSkuLinks } from "@/src/infrastructure/db/schema";
import { connect } from "../prices/db";
import { listChunks, loadBranch, loadBranchItems, readChunkInput, readChunkOutput, requiredArg, workDir } from "./work";

/**
 * Imports a branch's enriched price file: one product per barcode (name, aliases, shelf
 * group from the enrichment files), shared across chains - only the chain's own label
 * belongs to the chain - each linked to its barcode in product_sku_links. Only chunks
 * that pass validation are read. Admin-edited products keep their name/aliases/group.
 * Products no price file carries any more are deactivated, never deleted - unless this
 * file is stale or too many would go at once (--force-deactivate overrides).
 *
 * Usage: tsx scripts/catalog/import-branch-catalog.ts --chain=rami-levy --store-code=63
 *          [--dry-run] [--force-deactivate] [--prod]
 */

const WRITE_BATCH = 500;
const MAX_DEACTIVATE_SHARE = 0.1;
const STALE_FILE_DAYS = 3;

async function main() {
  const chain = requiredArg("chain");
  const storeCode = requiredArg("store-code");
  const dryRun = process.argv.includes("--dry-run");
  const forceDeactivate = process.argv.includes("--force-deactivate");
  const { sql, db, target } = connect();
  const branch = await loadBranch(sql, chain, storeCode);
  console.log(
    `[${target}] ${chain}/${storeCode} ${branch.name} (own label "${branch.chain.brandName}" -> "${branch.chain.navioChainId}")${dryRun ? " [dry run]" : ""}`,
  );

  const enriched = new Map<string, EnrichedItem>();
  let skippedChunks = 0;
  for (const chunk of listChunks(workDir(chain, storeCode))) {
    const output = readChunkOutput(chunk);
    if (output === undefined) continue;
    const { items, errors } = validateEnrichment(readChunkInput(chunk), output);
    if (errors.length > 0) {
      skippedChunks++;
      console.log(`  skipping chunk-${chunk.id}: ${errors.length} problems (run validate-enrichment)`);
      continue;
    }
    for (const item of items) enriched.set(item.itemKey, item);
  }

  const branchItems = await loadBranchItems(sql, chain, storeCode);
  const existing = await db
    .select({ id: products.id, sourceItemKey: products.sourceItemKey, isActive: products.isActive, manuallyEdited: products.manuallyEdited })
    .from(products)
    .where(drizzleSql`${products.sourceItemKey} IS NOT NULL`);
  const stillSold = new Set(
    (await sql`SELECT item_key FROM retail_items WHERE branch_count > 0`).map((r) => r.item_key as string),
  );
  const plan = planCatalogSync(
    branch.chain,
    existing.map((p) => ({ ...p, sourceItemKey: p.sourceItemKey! })),
    branchItems.map((item) => item.itemKey),
    enriched,
    stillSold,
  );

  const activeCount = existing.filter((p) => p.isActive).length;
  const staleDays = branch.priceFileAt ? (Date.now() - new Date(branch.priceFileAt).getTime()) / 86_400_000 : Infinity;
  let deactivate = plan.deactivate;
  if (!forceDeactivate && deactivate.length > 0) {
    if (staleDays > STALE_FILE_DAYS) {
      console.log(`  not deactivating ${deactivate.length}: price file is ${staleDays.toFixed(1)} days old`);
      deactivate = [];
    } else if (deactivate.length > activeCount * MAX_DEACTIVATE_SHARE) {
      console.log(`  not deactivating ${deactivate.length} of ${activeCount} active (over ${MAX_DEACTIVATE_SHARE * 100}%)`);
      deactivate = [];
    }
  }

  console.log(
    `  ${branchItems.length} items in the price file, ${enriched.size} enriched${skippedChunks ? ` (${skippedChunks} chunks skipped)` : ""}`,
  );
  console.log(
    `  upsert ${plan.upsert.length}, reactivate ${plan.reactivate.length}, deactivate ${deactivate.length}, not enriched yet ${plan.notEnriched.length}`,
  );
  if (dryRun) return;

  const now = new Date().toISOString();
  for (let i = 0; i < plan.upsert.length; i += WRITE_BATCH) {
    const batch = plan.upsert.slice(i, i + WRITE_BATCH);
    await db
      .insert(products)
      .values(batch.map((p) => ({ ...p, imageUrl: null, chainId: p.chainId ?? null, manuallyEdited: false })))
      .onConflictDoUpdate({
        target: products.id,
        set: {
          canonicalName: drizzleSql`excluded.canonical_name`,
          aliases: drizzleSql`excluded.aliases`,
          normalizedAliases: drizzleSql`excluded.normalized_aliases`,
          category: drizzleSql`excluded.category`,
          department: drizzleSql`excluded.department`,
          shelfGroup: drizzleSql`excluded.shelf_group`,
          chainId: drizzleSql`excluded.chain_id`,
          isActive: true,
        },
        setWhere: drizzleSql`${products.manuallyEdited} = false`,
      });
    await db
      .insert(productSkuLinks)
      .values(batch.map((p) => ({ productId: p.id, itemKey: p.sourceItemKey!, source: "import", score: 1, isTypical: true, updatedAt: now })))
      .onConflictDoNothing();
    console.log(`  wrote ${Math.min(i + WRITE_BATCH, plan.upsert.length)}/${plan.upsert.length}`);
  }
  for (const [ids, isActive] of [
    [plan.reactivate, true],
    [deactivate, false],
  ] as const) {
    for (let i = 0; i < ids.length; i += WRITE_BATCH) {
      await db.update(products).set({ isActive }).where(inArray(products.id, ids.slice(i, i + WRITE_BATCH)));
    }
  }
  console.log("  done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
