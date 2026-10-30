import { readFileSync, writeFileSync } from "fs";
import { validateEnrichment, type EnrichedItem } from "@/src/infrastructure/catalog/catalog-import";
import { connect } from "../prices/db";
import { listChunks, readChunkInput, requiredArg, workDir } from "./work";

/**
 * Copies admin edits of imported products (name, aliases, shelf group - products
 * marked manually_edited) from a database back into the branch's enrichment files,
 * so git keeps them: an import into another database (dev -> production) then
 * carries the edit instead of the original enrichment. Run it against every
 * database edits were made in, then commit the changed files.
 *
 * Usage: tsx scripts/catalog/sync-manual-edits.ts --chain=rami-levy --store-code=63 [--prod]
 */

/** One item per line, as enrichment writes them - keeps diffs to the edited lines. */
export function formatChunk(items: EnrichedItem[]): string {
  return `[\n${items.map((item) => JSON.stringify(item)).join(",\n")}\n]\n`;
}

async function main() {
  const chain = requiredArg("chain");
  const storeCode = requiredArg("store-code");
  const { sql, target } = connect();
  const rows = await sql`
    SELECT source_item_key, canonical_name, aliases, shelf_group FROM products
    WHERE manually_edited AND source_item_key IS NOT NULL`;
  const edits = new Map(
    rows.map((r) => [
      r.source_item_key as string,
      { name: r.canonical_name as string, aliases: r.aliases as string[], group: r.shelf_group as string },
    ]),
  );
  console.log(`[${target}] ${edits.size} edited imported products`);

  for (const chunk of listChunks(workDir(chain, storeCode))) {
    let raw: string;
    try {
      raw = readFileSync(chunk.outPath, "utf8");
    } catch {
      continue;
    }
    const items = JSON.parse(raw) as EnrichedItem[];
    let changed = 0;
    const next = items.map((item) => {
      const edit = edits.get(item.itemKey);
      if (!edit) return item;
      const updated = { itemKey: item.itemKey, ...edit };
      if (JSON.stringify(updated) === JSON.stringify(item)) return item;
      changed++;
      console.log(`  chunk-${chunk.id} ${item.itemKey}: ${item.name} -> ${edit.name} [${edit.aliases.join(", ")}] ${edit.group}`);
      return updated;
    });
    if (changed === 0) continue;
    const { errors } = validateEnrichment(readChunkInput(chunk), next);
    if (errors.length > 0) {
      console.log(`  chunk-${chunk.id}: edits break validation, not written: ${errors.slice(0, 3).join("; ")}`);
      continue;
    }
    writeFileSync(chunk.outPath, formatChunk(next));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
