import { describe, expect, it } from "vitest";
import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import { proposeConnections } from "@/src/presentation/components/admin/auto-connect";

const W = 1000;
const H = 1000;

function node(id: string, type: MapNode["type"], x: number, y: number): MapNode {
  return { id, storeId: "s", type, label: id, position: { x, y } };
}
function edge(id: string, from: string, to: string): MapEdge {
  return { id, storeId: "s", fromNodeId: from, toNodeId: to, bidirectional: true };
}

// A horizontal corridor w1-w2 at y = 0.5, and a vertical one w2-w3 at x = 0.9.
const corridor = [node("w1", "waypoint", 0.1, 0.5), node("w2", "waypoint", 0.9, 0.5), node("w3", "waypoint", 0.9, 0.1)];
const corridorEdges = [edge("e1", "w1", "w2"), edge("e2", "w2", "w3")];
const options = { maxDistance: 200, joinPointDistance: 10 };

describe("auto-connect departments", () => {
  it("proposes the spot on the nearest corridor right across from an unconnected department", () => {
    const { proposals, tooFar } = proposeConnections(
      [...corridor, node("dairy", "department", 0.4, 0.42)],
      corridorEdges,
      W,
      H,
      options,
    );
    expect(tooFar).toEqual([]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].nodeId).toBe("dairy");
    expect(proposals[0].target).toMatchObject({ kind: "edge", edgeId: "e1", y: 0.5 });
    expect(proposals[0].target.x).toBeCloseTo(0.4);
  });

  it("uses the corridor's waypoint when the spot falls right by it", () => {
    const { proposals } = proposeConnections([...corridor, node("bread", "department", 0.105, 0.45)], corridorEdges, W, H, options);
    expect(proposals[0].target).toEqual({ kind: "node", nodeId: "w1", x: 0.1, y: 0.5 });
  });

  it("leaves connected departments alone and reports ones too far from any corridor", () => {
    const nodes = [...corridor, node("meat", "department", 0.5, 0.45), node("far", "department", 0.3, 0.95)];
    const { proposals, tooFar } = proposeConnections(nodes, [...corridorEdges, edge("e3", "meat", "w1")], W, H, options);
    expect(proposals).toEqual([]);
    expect(tooFar).toEqual(["far"]);
  });

  it("only joins corridors, not another department's link", () => {
    const nodes = [...corridor, node("a", "department", 0.5, 0.2), node("b", "department", 0.5, 0.3)];
    // b is linked to w1 by a spur edge passing right next to a; a must still go to a corridor.
    const { proposals } = proposeConnections(nodes, [...corridorEdges, edge("spur", "b", "w1")], W, H, {
      ...options,
      maxDistance: 1000,
    });
    expect(proposals).toHaveLength(1);
    expect(proposals[0].target).toMatchObject({ kind: "edge" });
    expect(["e1", "e2"]).toContain((proposals[0].target as { edgeId: string }).edgeId);
  });
});
