import { createHash } from "crypto";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { Product } from "@smartroute/core/domain/entities/product";
import * as schema from "@/src/infrastructure/db/schema";
import { productCatalog } from "./product-catalog-data";

/**
 * Adds the generic supermarket catalog (product-catalog-data.ts) to the global products
 * table. Insert-only and idempotent: never updates or deletes, skips any product whose
 * name already matches an existing product's name/alias, and drops individual aliases
 * that another product already owns (so classification never becomes ambiguous).
 *
 * Usage: tsx scripts/seed/seed-product-catalog.ts [--prod] [--dry-run]
 *   default   -> dev branch (.env.development.local)
 *   --prod    -> production (.env.local)
 */

function readEnvVar(envFile: string, key: string): string {
  const content = readFileSync(envFile, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${envFile}`);
  return line.slice(key.length + 1).trim().replace(/^"|"$/g, "");
}

// Deterministic id so a re-run (or a run against another database) produces the same ids.
function catalogId(canonicalName: string): string {
  return `cat-${createHash("sha1").update(canonicalName).digest("hex").slice(0, 12)}`;
}

async function main() {
  const isProd = process.argv.includes("--prod");
  const isDryRun = process.argv.includes("--dry-run");
  const envFile = isProd ? ".env.local" : ".env.development.local";
  const db = drizzle(neon(readEnvVar(envFile, "DATABASE_URL")), { schema });
  console.log(`Target: ${isProd ? "PRODUCTION" : "dev branch"} (${envFile})${isDryRun ? " [dry run]" : ""}`);

  const existing = await db.select().from(schema.products);
  const takenNames = new Set(existing.flatMap((p) => p.normalizedAliases));

  const toInsert: Product[] = [];
  const skipped: string[] = [];
  const droppedAliases: string[] = [];

  for (const { department, category, products } of productCatalog) {
    for (const [canonicalName, ...rawAliases] of products) {
      const normalizedName = normalizeHebrewText(canonicalName);
      if (takenNames.has(normalizedName)) {
        skipped.push(canonicalName);
        continue;
      }
      takenNames.add(normalizedName);

      const aliases: string[] = [];
      for (const alias of rawAliases) {
        const normalized = normalizeHebrewText(alias);
        if (normalized === normalizedName) continue;
        if (takenNames.has(normalized)) {
          droppedAliases.push(`${alias} (${canonicalName})`);
          continue;
        }
        takenNames.add(normalized);
        aliases.push(alias);
      }

      toInsert.push({
        id: catalogId(canonicalName),
        canonicalName,
        aliases,
        normalizedAliases: [normalizedName, ...aliases.map(normalizeHebrewText)],
        category,
        department,
        isActive: true,
      });
    }
  }

  if (skipped.length) console.log(`Skipped ${skipped.length} products that already exist.`);
  if (droppedAliases.length) console.log(`Dropped conflicting aliases: ${droppedAliases.join(", ")}`);

  if (!isDryRun && toInsert.length) {
    const inserted = await db
      .insert(schema.products)
      .values(toInsert)
      .onConflictDoNothing()
      .returning({ id: schema.products.id });
    console.log(`Inserted ${inserted.length} products (had ${existing.length}).`);
  } else {
    console.log(`Would insert ${toInsert.length} products (have ${existing.length}).`);
  }
}

main().catch((err) => {
  console.error("Catalog seed failed:", err);
  process.exitCode = 1;
});
