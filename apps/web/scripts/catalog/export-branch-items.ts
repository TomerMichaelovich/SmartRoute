import { createHash } from "crypto";
import { writeFileSync } from "fs";
import path from "path";
import type { BranchItem } from "@/src/infrastructure/catalog/catalog-import";
import { connect } from "../prices/db";
import { arg, listChunks, loadBranch, loadBranchItems, readChunkInput, requiredArg, workDir } from "./work";

/**
 * Writes the branch's items that still need enrichment into chunk files
 * (work/<chain>-<store>/in/chunk-NNN.jsonl), skipping barcodes already imported (from
 * any branch or chain) or already in a chunk, so a re-run after a new price file - or
 * the next branch - exports only what's new.
 *
 * Usage: tsx scripts/catalog/export-branch-items.ts --chain=rami-levy --store-code=63
 *          [--size=200] [--sample=200] [--prod]
 *   --size     items per chunk; chunks are sorted by name so similar items sit together
 *   --sample   a single chunk of N items spread across the whole file (10% weighted), for review
 */

const SAMPLE_WEIGHTED_SHARE = 0.1;

function spreadOrder(items: BranchItem[]): BranchItem[] {
  const hash = (key: string) => createHash("sha1").update(key).digest("hex");
  return [...items].sort((a, b) => hash(a.itemKey).localeCompare(hash(b.itemKey)));
}

async function main() {
  const chain = requiredArg("chain");
  const storeCode = requiredArg("store-code");
  const size = Number(arg("size") ?? 200);
  const sample = arg("sample") ? Number(arg("sample")) : null;
  const { sql, target } = connect();
  const branch = await loadBranch(sql, chain, storeCode);
  const dirs = workDir(chain, storeCode);

  const items = await loadBranchItems(sql, chain, storeCode);
  const imported = await sql`SELECT source_item_key FROM products WHERE source_item_key IS NOT NULL`;
  const chunks = listChunks(dirs);
  const handled = new Set([
    ...imported.map((r) => r.source_item_key as string),
    ...chunks.flatMap((chunk) => readChunkInput(chunk).map((item) => item.itemKey)),
  ]);
  const pending = items.filter((item) => !handled.has(item.itemKey));
  console.log(`[${target}] ${chain}/${storeCode} ${branch.name}: ${items.length} items, ${pending.length} not yet exported`);

  let batches: BranchItem[][];
  if (sample) {
    const spread = spreadOrder(pending);
    const weighted = spread.filter((item) => item.isWeighted).slice(0, Math.round(sample * SAMPLE_WEIGHTED_SHARE));
    const rest = spread.filter((item) => !item.isWeighted).slice(0, sample - weighted.length);
    batches = [[...weighted, ...rest].sort((a, b) => a.name.localeCompare(b.name, "he"))];
  } else {
    const sorted = [...pending].sort((a, b) => a.name.localeCompare(b.name, "he"));
    batches = [];
    for (let i = 0; i < sorted.length; i += size) batches.push(sorted.slice(i, i + size));
  }

  let next = chunks.length === 0 ? 1 : Number(chunks[chunks.length - 1].id) + 1;
  for (const batch of batches) {
    if (batch.length === 0) continue;
    const file = path.join(dirs.in, `chunk-${String(next).padStart(3, "0")}.jsonl`);
    writeFileSync(file, batch.map((item) => JSON.stringify(item)).join("\n") + "\n");
    console.log(`  ${file}: ${batch.length} items`);
    next++;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
