import "../env";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { db } from "@/src/infrastructure/db/client";
import {
  analyticsEvents,
  classificationCache,
  mapEdges,
  mapNodes,
  productListings,
  products,
  promotions,
  routes,
  shoppingLists,
  stores,
} from "@/src/infrastructure/db/schema";

const TABLES = [
  routes,
  shoppingLists,
  productListings,
  promotions,
  mapEdges,
  mapNodes,
  products,
  stores,
  classificationCache,
  analyticsEvents,
];

/**
 * There is only ever one DATABASE_URL for this project (no separate dev/test
 * branch) - this wipes every table, including stores, unconditionally. Every
 * caller (this script's CLI entrypoint and `npm run seed`) goes through this
 * one function, so the confirmation lives here rather than being duplicated
 * per-caller and risking a new script skipping it.
 */
export async function resetData(): Promise<void> {
  let host = "(unable to parse DATABASE_URL)";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    // leave the fallback message
  }

  const rl = readline.createInterface({ input: stdin, output: stdout });
  console.log(`This permanently deletes ALL data (stores, routes, analytics, products, promotions, ...) from:`);
  console.log(`  ${host}`);
  const answer = await rl.question('Type "RESET" to confirm, anything else to abort: ');
  rl.close();
  if (answer.trim() !== "RESET") {
    throw new Error("Aborted - no data was deleted.");
  }

  for (const table of TABLES) {
    await db.delete(table);
  }
}

async function main() {
  await resetData();
  console.log("Postgres tables reset to empty.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  });
}
