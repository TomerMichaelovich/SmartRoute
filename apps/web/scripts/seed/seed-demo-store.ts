import "../env";
import { PgEdgeRepository } from "@/src/infrastructure/repositories/postgres/pg-edge-repository";
import { PgNodeRepository } from "@/src/infrastructure/repositories/postgres/pg-node-repository";
import { PgProductListingRepository } from "@/src/infrastructure/repositories/postgres/pg-product-listing-repository";
import { PgProductRepository } from "@/src/infrastructure/repositories/postgres/pg-product-repository";
import { PgPromotionRepository } from "@/src/infrastructure/repositories/postgres/pg-promotion-repository";
import { PgStoreRepository } from "@/src/infrastructure/repositories/postgres/pg-store-repository";
import {
  demoEdges,
  demoNodes,
  demoProductListings,
  demoProducts,
  demoPromotions,
  demoStore,
} from "./demo-store-data";
import { resetData } from "./reset-data";

function assertGraphConnected(): void {
  const adjacency = new Map<string, Set<string>>();
  for (const n of demoNodes) adjacency.set(n.id, new Set());
  for (const e of demoEdges) {
    if (!adjacency.has(e.fromNodeId) || !adjacency.has(e.toNodeId)) {
      throw new Error(`Edge ${e.id} references a node that doesn't exist`);
    }
    adjacency.get(e.fromNodeId)!.add(e.toNodeId);
    if (e.bidirectional) adjacency.get(e.toNodeId)!.add(e.fromNodeId);
  }

  const entrance = demoNodes.find((n) => n.type === "entrance");
  if (!entrance) throw new Error("Demo store graph has no entrance node");

  const visited = new Set<string>([entrance.id]);
  const queue = [entrance.id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const orphans = demoNodes.filter((n) => !visited.has(n.id));
  if (orphans.length > 0) {
    throw new Error(
      `Orphan nodes unreachable from entrance: ${orphans.map((n) => `${n.id} (${n.label})`).join(", ")}`,
    );
  }
}

async function main() {
  assertGraphConnected();
  await resetData();

  const storeRepo = new PgStoreRepository();
  const nodeRepo = new PgNodeRepository();
  const edgeRepo = new PgEdgeRepository();
  const productRepo = new PgProductRepository();
  const productListingRepo = new PgProductListingRepository();
  const promotionRepo = new PgPromotionRepository();

  await storeRepo.create(demoStore);
  for (const n of demoNodes) await nodeRepo.create(n);
  for (const e of demoEdges) await edgeRepo.create(e);
  for (const p of demoProducts) await productRepo.create(p);
  for (const l of demoProductListings) await productListingRepo.create(l);
  for (const promo of demoPromotions) await promotionRepo.create(promo);

  console.log(
    `Seeded 1 store, ${demoNodes.length} nodes, ${demoEdges.length} edges, ${demoProducts.length} products, ${demoProductListings.length} listings, ${demoPromotions.length} promotions.`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});
