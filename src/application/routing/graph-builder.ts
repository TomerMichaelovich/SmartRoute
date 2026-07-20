import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";

export interface GraphNeighbor {
  to: string;
  distance: number;
}

export interface Graph {
  nodes: Map<string, MapNode>;
  adjacency: Map<string, GraphNeighbor[]>;
}

/** Builds a weighted adjacency list for one store. Every MVP edge is bidirectional. */
export function buildGraph(nodes: MapNode[], edges: MapEdge[]): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, GraphNeighbor[]>();
  for (const n of nodes) adjacency.set(n.id, []);

  for (const e of edges) {
    if (!adjacency.has(e.fromNodeId) || !adjacency.has(e.toNodeId)) continue;
    adjacency.get(e.fromNodeId)!.push({ to: e.toNodeId, distance: e.distanceMeters });
    if (e.bidirectional) {
      adjacency.get(e.toNodeId)!.push({ to: e.fromNodeId, distance: e.distanceMeters });
    }
  }

  return { nodes: nodeMap, adjacency };
}
