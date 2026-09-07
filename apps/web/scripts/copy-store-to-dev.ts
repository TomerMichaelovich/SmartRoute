import { readFileSync } from "fs";
import { eq, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/src/infrastructure/db/schema";

/**
 * One-off utility: copies one store (and everything needed to render/route it - nodes,
 * edges, product listings, and any referenced products not already in dev) from
 * production into the isolated Neon dev branch, so it can be exercised in local/mobile
 * testing without ever writing to production. Read-only against prod; every dev write
 * uses onConflictDoNothing so a re-run can't clobber or duplicate existing dev data.
 *
 * Usage: tsx scripts/copy-store-to-dev.ts "<store name substring>"
 */

function readEnvVar(envFile: string, key: string): string {
  const content = readFileSync(envFile, "utf8");
  const line = content.split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${envFile}`);
  return line.slice(key.length + 1).trim();
}

async function main() {
  const nameQuery = process.argv[2];
  if (!nameQuery) {
    console.error('Usage: tsx scripts/copy-store-to-dev.ts "<store name substring>"');
    process.exit(1);
  }

  const prodUrl = readEnvVar(".env.local", "DATABASE_URL");
  const devUrl = readEnvVar(".env.development.local", "DATABASE_URL");
  const prodDb = drizzle(neon(prodUrl), { schema });
  const devDb = drizzle(neon(devUrl), { schema });

  const matches = await prodDb.query.stores.findMany();
  const store = matches.find((s) => s.name.includes(nameQuery));
  if (!store) {
    console.error(`No production store found with name containing "${nameQuery}"`);
    console.error("Available store names:", matches.map((s) => s.name).join(", "));
    process.exit(1);
  }
  console.log(`Found: ${store.name} (${store.id})`);

  const [nodes, edges, listings] = await Promise.all([
    prodDb.select().from(schema.mapNodes).where(eq(schema.mapNodes.storeId, store.id)),
    prodDb.select().from(schema.mapEdges).where(eq(schema.mapEdges.storeId, store.id)),
    prodDb.select().from(schema.productListings).where(eq(schema.productListings.storeId, store.id)),
  ]);
  console.log(`Nodes: ${nodes.length}, edges: ${edges.length}, product listings: ${listings.length}`);

  const productIds = [...new Set(listings.map((l) => l.productId))];
  const products = productIds.length
    ? await prodDb.select().from(schema.products).where(inArray(schema.products.id, productIds))
    : [];

  const existingDevProductIds = productIds.length
    ? new Set(
        (await devDb.select({ id: schema.products.id }).from(schema.products).where(inArray(schema.products.id, productIds))).map(
          (p) => p.id,
        ),
      )
    : new Set<string>();
  const missingProducts = products.filter((p) => !existingDevProductIds.has(p.id));
  console.log(`Products referenced: ${products.length}, missing from dev (will copy): ${missingProducts.length}`);

  await devDb.insert(schema.stores).values(store).onConflictDoNothing();
  if (missingProducts.length) {
    await devDb.insert(schema.products).values(missingProducts).onConflictDoNothing();
  }
  if (nodes.length) {
    await devDb.insert(schema.mapNodes).values(nodes).onConflictDoNothing();
  }
  if (edges.length) {
    await devDb.insert(schema.mapEdges).values(edges).onConflictDoNothing();
  }
  if (listings.length) {
    await devDb.insert(schema.productListings).values(listings).onConflictDoNothing();
  }

  console.log(`Done. "${store.name}" is now available on the dev branch.`);
}

main();
