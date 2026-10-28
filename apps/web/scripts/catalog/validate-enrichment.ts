import { writeFileSync } from "fs";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { validateEnrichment } from "@/src/infrastructure/catalog/catalog-import";
import { arg, listChunks, readChunkInput, readChunkOutput, requiredArg, workDir } from "./work";

/**
 * Checks each enrichment file against its chunk (see validateEnrichment) and says
 * which chunks are done, failing or still pending. Exits 1 if any written chunk fails.
 *
 * Usage: tsx scripts/catalog/validate-enrichment.ts --chain=rami-levy --store-code=63
 *          [--chunk=001[,002]] [--csv=<file>]
 *   --csv   writes the checked items as a CSV for review (Excel-friendly UTF-8)
 */

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function main() {
  const chain = requiredArg("chain");
  const storeCode = requiredArg("store-code");
  const only = arg("chunk")?.split(",");
  const csvPath = arg("csv");
  const dirs = workDir(chain, storeCode);

  const chunks = listChunks(dirs).filter((chunk) => !only || only.includes(chunk.id));
  const pending: string[] = [];
  const csv: string[][] = [["chunk", "itemKey", "שם בקובץ", "יצרן", "שם", "כינויים", "קבוצה", "שם קבוצה"]];
  let done = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const output = readChunkOutput(chunk);
    if (output === undefined) {
      pending.push(chunk.id);
      continue;
    }
    const input = readChunkInput(chunk);
    const { items, errors } = validateEnrichment(input, output);
    if (errors.length > 0) {
      failed++;
      console.log(`chunk-${chunk.id}: ${errors.length} problems`);
      for (const error of errors.slice(0, 20)) console.log(`  ${error}`);
      continue;
    }
    done++;
    const byKey = new Map(input.map((item) => [item.itemKey, item]));
    for (const item of items) {
      const source = byKey.get(item.itemKey)!;
      csv.push([chunk.id, item.itemKey, source.name, source.manufacturer ?? "", item.name, item.aliases.join(" | "), item.group, findShelfGroup(item.group)!.name]);
    }
  }

  console.log(`${done} chunks OK, ${failed} failing, ${pending.length} pending${pending.length ? `: ${pending.join(",")}` : ""}`);
  if (csvPath) {
    writeFileSync(csvPath, "﻿" + csv.map((row) => row.map(csvCell).join(",")).join("\n") + "\n");
    console.log(`CSV: ${csvPath} (${csv.length - 1} items)`);
  }
  if (failed > 0) process.exit(1);
}

main();
