import { describe, expect, it } from "vitest";
import { demoEdges, demoNodes, demoProducts } from "@/tests/fixtures/demo-store.fixture";
import { buildGraph } from "@/src/application/routing/graph-builder";
import { dijkstra } from "@/src/application/routing/dijkstra";
import { buildRoute } from "@/src/application/routing/route-service";
import { computeBacktrackCount, computeTotalDistance } from "@/src/application/routing/route-metrics";
import type { ShoppingListItem } from "@/src/domain/entities/shopping-list";
import type { ClassificationResult } from "@/src/domain/entities/classification-result";

function productByName(name: string) {
  const product = demoProducts.find((p) => p.canonicalName === name);
  if (!product) throw new Error(`Fixture missing expected product: ${name}`);
  return product;
}

function itemFor(id: string, canonicalName: string): ShoppingListItem {
  const product = productByName(canonicalName);
  const classification: ClassificationResult = {
    rawText: canonicalName,
    matchedProductId: product.id,
    confidence: 1,
    source: "dictionary",
  };
  return { id, rawText: canonicalName, classification };
}

describe("dijkstra against the seeded store graph", () => {
  // Ground truth computed by running the real implementation against the
  // seeded graph (see plan §5 / roadmap phase 5) - the entrance-checkout
  // direct edge (5m) makes several of these shorter via checkout than the
  // "long way around" through bakery/dairy/frozen.
  const graph = buildGraph(demoNodes, demoEdges);
  const fromEntrance = dijkstra(graph, "n-entrance");

  it.each([
    ["n-produce", 6],
    ["n-checkout", 5],
    ["n-bakery", 14],
    ["n-int-1", 17],
    ["n-dairy", 27],
    ["n-meat-fish", 15],
    ["n-int-3", 25],
    ["n-personal-care", 28],
    ["n-beverages", 40],
  ])("shortest distance entrance -> %s is %i", (nodeId, expected) => {
    expect(fromEntrance.distances.get(nodeId)).toBe(expected);
  });
});

describe("route-metrics", () => {
  const graph = buildGraph(demoNodes, demoEdges);

  it("sums edge weights along a path", () => {
    expect(computeTotalDistance(graph, ["n-entrance", "n-produce", "n-bakery"])).toBe(14);
  });

  it("throws for a path with no matching edge", () => {
    expect(() => computeTotalDistance(graph, ["n-entrance", "n-frozen"])).toThrow();
  });

  it("counts revisited nodes as backtracking", () => {
    expect(computeBacktrackCount(["a", "b", "c", "b", "d"])).toBe(1);
    expect(computeBacktrackCount(["a", "b", "c"])).toBe(0);
  });
});

describe("buildRoute", () => {
  it("orders stops, reconstructs the path, and computes metrics for a mixed list", () => {
    const items = [
      itemFor("item-0", "עגבניות"),
      itemFor("item-1", "חלב 3% תנובה 1 ליטר"),
      itemFor("item-2", "קוקה קולה 1.5 ליטר"),
      itemFor("item-3", "שמפו"),
    ];

    const route = buildRoute({
      routeId: "r-1",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-1",
      items,
      products: demoProducts,
      nodes: demoNodes,
      edges: demoEdges,
    });

    expect(route.stops.map((s) => s.nodeId)).toEqual([
      "n-produce",
      "n-dairy",
      "n-personal-care",
      "n-beverages",
    ]);
    expect(route.pathNodeIds[0]).toBe("n-entrance");
    expect(route.pathNodeIds.at(-1)).toBe("n-checkout");
    expect(route.totalDistanceMeters).toBe(112);
    expect(route.backtrackCount).toBe(1);
    expect(route.unresolvedItemIds).toEqual([]);
  });

  it("collapses items sharing a location into a single stop", () => {
    const items = [itemFor("item-0", "חלב 3% תנובה 1 ליטר"), itemFor("item-1", "קוטג'")];
    const route = buildRoute({
      routeId: "r-2",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-2",
      items,
      products: demoProducts,
      nodes: demoNodes,
      edges: demoEdges,
    });

    expect(route.stops).toHaveLength(1);
    expect(route.stops[0].nodeId).toBe("n-dairy");
    expect(route.stops[0].itemIds).toEqual(["item-0", "item-1"]);
  });

  it("routes an unclassified item into unresolvedItemIds and excludes it from pathing", () => {
    const unresolved: ShoppingListItem = {
      id: "item-x",
      rawText: "משהו שלא קיים",
      classification: { rawText: "משהו שלא קיים", confidence: 0, source: "unresolved" },
    };
    const items = [itemFor("item-0", "עגבניות"), unresolved];

    const route = buildRoute({
      routeId: "r-3",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-3",
      items,
      products: demoProducts,
      nodes: demoNodes,
      edges: demoEdges,
    });

    expect(route.unresolvedItemIds).toEqual(["item-x"]);
    expect(route.stops.some((s) => s.itemIds.includes("item-x"))).toBe(false);
  });

  it("returns an empty route when no items resolve to a location", () => {
    const unresolved: ShoppingListItem = {
      id: "item-x",
      rawText: "משהו שלא קיים",
    };
    const route = buildRoute({
      routeId: "r-4",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-4",
      items: [unresolved],
      products: demoProducts,
      nodes: demoNodes,
      edges: demoEdges,
    });

    expect(route.stops).toEqual([]);
    expect(route.pathNodeIds).toEqual([]);
    expect(route.totalDistanceMeters).toBe(0);
    expect(route.unresolvedItemIds).toEqual(["item-x"]);
  });
});
