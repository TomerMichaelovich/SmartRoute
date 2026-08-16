import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import { distanceBetweenNodes } from "@/src/domain/value-objects/geo-point";

export interface GraphNeighbor {
  to: string;
  distance: number;
}

export interface Graph {
  nodes: Map<string, MapNode>;
  adjacency: Map<string, GraphNeighbor[]>;
}

/**
 * Builds a weighted adjacency list for one store. Every MVP edge is bidirectional. Edge
 * weights are computed on the fly from node positions in the store's pixel canvas (not
 * read from a stored field), so they're always correct even right after a node is
 * dragged to a new spot. These are relative map-space units, not real-world distance.
 */
export function buildGraph(
  nodes: MapNode[],
  edges: MapEdge[],
  mapWidth: number,
  mapHeight: number,
): Graph {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, GraphNeighbor[]>();
  for (const n of nodes) adjacency.set(n.id, []);

  for (const e of edges) {
    const from = nodeMap.get(e.fromNodeId);
    const to = nodeMap.get(e.toNodeId);
    if (!from || !to) continue;
    const distance = distanceBetweenNodes(from.position, to.position, mapWidth, mapHeight);
    adjacency.get(e.fromNodeId)!.push({ to: e.toNodeId, distance });
    if (e.bidirectional) {
      adjacency.get(e.toNodeId)!.push({ to: e.fromNodeId, distance });
    }
  }

  return { nodes: nodeMap, adjacency };
}
