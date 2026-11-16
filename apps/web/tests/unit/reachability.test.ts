import { describe, expect, it } from "vitest";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import { buildGraph } from "@smartroute/core/application/routing/graph-builder";
import { findUnroutableNodeIds } from "@smartroute/core/application/routing/reachability";

function node(id: string, type: MapNode["type"]): MapNode {
  return { id, storeId: "s", type, label: id, position: { x: 0, y: 0 } };
}
function edge(from: string, to: string): MapEdge {
  return { id: `${from}-${to}`, storeId: "s", fromNodeId: from, toNodeId: to, bidirectional: true };
}

// entrance - w1 - dept - w2 - checkout - w3 - exit
const store = [
  node("entrance", "entrance"),
  node("w1", "waypoint"),
  node("dept", "department"),
  node("w2", "waypoint"),
  node("checkout", "checkout"),
  node("w3", "waypoint"),
  node("exit", "exit"),
];
const storeEdges = [
  edge("entrance", "w1"),
  edge("w1", "dept"),
  edge("dept", "w2"),
  edge("w2", "checkout"),
  edge("checkout", "w3"),
  edge("w3", "exit"),
];

describe("route reachability", () => {
  it("doesn't report the way out past the checkout", () => {
    expect(findUnroutableNodeIds(store, storeEdges)).toEqual(new Set());
  });

  it("reports a department only reachable through the checkout", () => {
    const nodes = [...store, node("late", "department")];
    expect(findUnroutableNodeIds(nodes, [...storeEdges, edge("w3", "late")])).toEqual(new Set(["late"]));
  });

  it("reports the departments when the route's entrance only leads in through the checkout", () => {
    // The real case: an exit saved as a second entrance, listed first, so routes start there.
    // The store's waypoints look like "the way out" from there, but every department (and the
    // real entrance) is flagged - that's what route building fails on.
    const nodes = [node("exit-as-entrance", "entrance"), ...store.filter((n) => n.type !== "exit")];
    const edges = [...storeEdges.filter((e) => e.toNodeId !== "exit"), edge("w3", "exit-as-entrance")];
    expect(findUnroutableNodeIds(nodes, edges)).toEqual(new Set(["entrance", "dept"]));
  });

  it("routes never walk on from an exit", () => {
    const graph = buildGraph(store, storeEdges, 100, 100);
    expect(graph.adjacency.get("exit")).toEqual([]);
  });
});
