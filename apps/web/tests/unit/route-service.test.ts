import { describe, expect, it } from "vitest";
import {
  demoEdges,
  demoNodes,
  demoProductListings,
  demoProducts,
  demoStore,
} from "@/tests/fixtures/demo-store.fixture";
import { buildGraph } from "@smartroute/core/application/routing/graph-builder";
import { dijkstra } from "@smartroute/core/application/routing/dijkstra";
import { buildRoute } from "@smartroute/core/application/routing/route-service";
import { computeBacktrackCount, computeTotalDistance } from "@smartroute/core/application/routing/route-metrics";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";

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
  // Ground truth computed by running the real implementation against the seeded graph -
  // edge weights are straight-line distance between node coordinates in the store's pixel
  // canvas (relative map-space units, not real-world distance), not hand-typed integers, so
  // these are irrational and compared with a tolerance. The entrance-checkout direct edge
  // still makes several of these shorter via checkout than the "long way around" through
  // bakery/dairy/frozen.
  const graph = buildGraph(demoNodes, demoEdges, demoStore.mapWidth, demoStore.mapHeight);
  const fromEntrance = dijkstra(graph, "n-entrance");

  it.each([
    ["n-produce", 100],
    ["n-checkout", 350],
    ["n-bakery", 250],
    ["n-int-1", 550],
    ["n-dairy", 850],
    ["n-meat-fish", 920.087713],
    ["n-int-3", 1220.087713],
    ["n-personal-care", 1021.699057],
    ["n-beverages", 1478.201596],
  ])("shortest distance entrance -> %s is ~%s", (nodeId, expected) => {
    expect(fromEntrance.distances.get(nodeId)).toBeCloseTo(expected, 5);
  });
});

describe("route-metrics", () => {
  const graph = buildGraph(demoNodes, demoEdges, demoStore.mapWidth, demoStore.mapHeight);

  it("sums edge weights along a path", () => {
    expect(computeTotalDistance(graph, ["n-entrance", "n-produce", "n-bakery"])).toBeCloseTo(250, 5);
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
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
    });

    expect(route.stops.map((s) => s.nodeId)).toEqual([
      "n-produce",
      "n-dairy",
      "n-beverages",
      "n-personal-care",
    ]);
    expect(route.pathNodeIds[0]).toBe("n-entrance");
    expect(route.pathNodeIds.at(-1)).toBe("n-checkout");
    expect(route.totalDistanceMeters).toBeCloseTo(3284.763915, 4);
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
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
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
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
    });

    expect(route.unresolvedItemIds).toEqual(["item-x"]);
    expect(route.stops.some((s) => s.itemIds.includes("item-x"))).toBe(false);
  });

  it("re-plans mid-shop from the last finished stop, keeping finished stops first", () => {
    const items = [
      itemFor("item-0", "עגבניות"),
      itemFor("item-1", "חלב 3% תנובה 1 ליטר"),
      itemFor("item-2", "קוקה קולה 1.5 ליטר"),
      itemFor("item-3", "שמפו"),
    ];
    const base = {
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-6",
      items,
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
    };
    // Collected produce, then shampoo (personal care) - the shopper now stands there.
    const route = buildRoute({ ...base, routeId: "r-6", completedItemIds: ["item-0", "item-3"] });

    expect(route.stops.slice(0, 2).map((s) => s.nodeId)).toEqual(["n-produce", "n-personal-care"]);
    const next = route.stops[2];
    expect(next.pathFromPrevious[0]).toBe("n-personal-care");
    expect(route.stops.map((s) => s.nodeId).sort()).toEqual(
      ["n-beverages", "n-dairy", "n-personal-care", "n-produce"].sort(),
    );
  });

  it("leaves items the shopper chose not to buy off the route", () => {
    const route = buildRoute({
      routeId: "r-7",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-7",
      items: [itemFor("item-0", "עגבניות"), itemFor("item-1", "שמפו")],
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
      skippedItemIds: ["item-1"],
    });

    expect(route.stops.map((s) => s.nodeId)).toEqual(["n-produce"]);
    expect(route.unresolvedItemIds).toEqual(["item-1"]);
  });

  it("treats a product listed at a deleted node as unresolved instead of failing the route", () => {
    const milk = productByName("חלב 3% תנובה 1 ליטר");
    const listings = demoProductListings.map((l) =>
      l.productId === milk.id ? { ...l, nodeId: "n-deleted" } : l,
    );
    const route = buildRoute({
      routeId: "r-5",
      storeId: "store-ramat-gan-1",
      shoppingListId: "sl-5",
      items: [itemFor("item-0", "עגבניות"), itemFor("item-1", "חלב 3% תנובה 1 ליטר")],
      listings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
    });

    expect(route.unresolvedItemIds).toEqual(["item-1"]);
    expect(route.stops.map((s) => s.itemIds)).toEqual([["item-0"]]);
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
      listings: demoProductListings,
      nodes: demoNodes,
      edges: demoEdges,
      mapWidth: demoStore.mapWidth,
      mapHeight: demoStore.mapHeight,
    });

    expect(route.stops).toEqual([]);
    expect(route.pathNodeIds).toEqual([]);
    expect(route.totalDistanceMeters).toBe(0);
    expect(route.unresolvedItemIds).toEqual(["item-x"]);
  });
});
