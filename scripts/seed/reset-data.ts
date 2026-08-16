import "../env";
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

export async function resetData(): Promise<void> {
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
