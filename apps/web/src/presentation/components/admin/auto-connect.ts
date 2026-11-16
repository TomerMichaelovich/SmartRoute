import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import { nearestOnSegment } from "./waypoint-line-draft";

/**
 * "Connect departments automatically": for every department (or entrance/checkout) with no
 * connection at all, the nearest corridor - an edge between two waypoints - and the spot on it
 * right across from the node, so the link is short and square to the corridor.
 */
export interface ConnectionProposal {
  nodeId: string;
  from: { x: number; y: number };
  /** An existing waypoint (the spot fell right by one), or a new one on that corridor edge. */
  target: { kind: "node"; nodeId: string; x: number; y: number } | { kind: "edge"; edgeId: string; x: number; y: number };
}

export interface ProposeOptions {
  /** Corridors farther than this (map units) are not proposed - the node is reported instead. */
  maxDistance: number;
  /** A spot this close (map units) to a corridor's waypoint uses that waypoint instead of a new one. */
  joinPointDistance: number;
}

export function proposeConnections(
  nodes: readonly MapNode[],
  edges: readonly MapEdge[],
  mapWidth: number,
  mapHeight: number,
  options: ProposeOptions,
): { proposals: ConnectionProposal[]; tooFar: string[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connected = new Set(edges.flatMap((e) => [e.fromNodeId, e.toNodeId]));
  const corridors = edges.flatMap((e) => {
    const a = byId.get(e.fromNodeId);
    const b = byId.get(e.toNodeId);
    return a?.type === "waypoint" && b?.type === "waypoint" ? [{ edge: e, a, b }] : [];
  });

  const proposals: ConnectionProposal[] = [];
  const tooFar: string[] = [];
  for (const node of nodes) {
    if (node.type === "waypoint" || connected.has(node.id)) continue;
    let best: { edgeId: string; a: MapNode; b: MapNode; t: number; point: { x: number; y: number }; d: number } | null =
      null;
    for (const { edge, a, b } of corridors) {
      const near = nearestOnSegment(a.position, b.position, node.position, mapWidth, mapHeight);
      if (!best || near.distance < best.d) best = { edgeId: edge.id, a, b, t: near.t, point: near.point, d: near.distance };
    }
    if (!best || best.d > options.maxDistance) {
      tooFar.push(node.id);
      continue;
    }
    const distanceTo = (n: MapNode) =>
      Math.hypot((n.position.x - best!.point.x) * mapWidth, (n.position.y - best!.point.y) * mapHeight);
    const end = distanceTo(best.a) <= distanceTo(best.b) ? best.a : best.b;
    proposals.push({
      nodeId: node.id,
      from: node.position,
      target:
        distanceTo(end) <= options.joinPointDistance
          ? { kind: "node", nodeId: end.id, ...end.position }
          : { kind: "edge", edgeId: best.edgeId, ...best.point },
    });
  }
  return { proposals, tooFar };
}
