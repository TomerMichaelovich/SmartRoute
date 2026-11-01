import { writeFileSync } from "fs";
import { and, eq, isNull } from "drizzle-orm";
import { ClassificationService } from "@smartroute/core/application/classification/classification-service";
import { dictionaryLayer } from "@smartroute/core/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@smartroute/core/application/classification/layers/fuzzy-match-layer";
import { normalizationLayer } from "@smartroute/core/application/classification/layers/normalization-layer";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import type { IClassificationCacheRepository } from "@smartroute/core/application/ports/classification-cache-repository";
import type { IProductRepository } from "@smartroute/core/application/ports/product-repository";
import { validateEnrichment } from "@/src/infrastructure/catalog/catalog-import";
import { products } from "@/src/infrastructure/db/schema";
import { productSchema } from "@/src/infrastructure/repositories/schemas";
import { connect } from "../prices/db";
import { arg, listChunks, readChunkInput, readChunkOutput, requiredArg, workDir } from "./work";

/**
 * What shoppers would write for a branch's imported products that classification
 * doesn't recognize: each alias in the enrichment files run through the generic catalog
 * (dictionary, normalization and fuzzy layers - no LLM, nothing written; the cache is in
 * memory). An unrecognized alias ("ג'ין", "בילואו") is a line the list marks as not
 * identified though the branch carries it; a fuzzy one may be recognized as the wrong
 * product. Both, by how many items carry the alias, are what to add to the generic
 * catalog - a new product for a kind of product, an alias for a brand or spelling.
 *
 * Usage: tsx scripts/catalog/report-unmatched-aliases.ts --chain=rami-levy --store-code=63
 *          --csv=<file> [--prod]
 */

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  const chain = requiredArg("chain");
  const storeCode = requiredArg("store-code");
  const csvPath = requiredArg("csv");
  const { db, target } = connect();

  // alias (normalized) -> as written, and the items carrying it.
  const aliases = new Map<string, { text: string; items: { name: string; group: string }[] }>();
  for (const chunk of listChunks(workDir(chain, storeCode))) {
    const output = readChunkOutput(chunk);
    if (output === undefined) continue;
    const { items, errors } = validateEnrichment(readChunkInput(chunk), output);
    if (errors.length > 0) continue;
    for (const item of items) {
      for (const alias of item.aliases) {
        const key = normalizeHebrewText(alias);
        if (!key) continue;
        const entry = aliases.get(key) ?? { text: alias, items: [] };
        entry.items.push({ name: item.name, group: item.group });
        aliases.set(key, entry);
      }
    }
  }

  const rows = await db.select().from(products).where(and(eq(products.isActive, true), isNull(products.sourceItemKey)));
  const catalog: Product[] = rows.map((r) => productSchema.parse({ ...r, imageUrl: r.imageUrl ?? undefined }));
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const productRepo = { findCatalog: async () => catalog, findAllActive: async () => catalog } as unknown as IProductRepository;
  const memory = new Map<string, ClassificationResult>();
  const cache: IClassificationCacheRepository = {
    get: async (key) => memory.get(key) ?? null,
    set: async (key, result) => void memory.set(key, result),
    delete: async (key) => void memory.delete(key),
  };
  const service = new ClassificationService([dictionaryLayer, normalizationLayer, fuzzyMatchLayer], cache, productRepo);
  console.log(`[${target}] ${aliases.size} distinct aliases, ${catalog.length} generic products`);

  const out: (string | number)[][] = [["כינוי", "פריטים", "תוצאה", "זוהה כ", "ביטחון", "קבוצות", "דוגמאות"]];
  let unresolved = 0;
  let fuzzy = 0;
  const entries = [...aliases.values()].sort((a, b) => b.items.length - a.items.length);
  for (const { text, items } of entries) {
    const result = await service.classify(text);
    if (result.source === "dictionary" || result.source === "normalization") continue;
    if (result.source === "fuzzy") fuzzy++;
    else unresolved++;
    const groups = [...new Set(items.map((i) => findShelfGroup(i.group)?.name ?? i.group))];
    out.push([
      text,
      items.length,
      result.source === "fuzzy" ? "מקורב" : "לא זוהה",
      byId.get(result.matchedProductId ?? "")?.canonicalName ?? "",
      result.source === "fuzzy" ? result.confidence.toFixed(2) : "",
      groups.slice(0, 3).join(" | "),
      items.slice(0, 3).map((i) => i.name).join(" | "),
    ]);
  }
  // Excel reads UTF-8 only with the BOM.
  writeFileSync(csvPath, "﻿" + out.map((r) => r.map(csvCell).join(",")).join("\n"));
  console.log(`  ${unresolved} not recognized, ${fuzzy} recognized only fuzzily -> ${csvPath}`);
  const top = arg("top");
  if (top) for (const r of out.slice(1, Number(top) + 1)) console.log(`  ${r[1]}\t${r[0]}\t${r[2]}${r[3] ? ` -> ${r[3]}` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
