import type { Graph } from "./graph-builder";

/** Sums edge weights along a walked path, looked up from the graph (not re-derived from Dijkstra). */
export function computeTotalDistance(graph: Graph, pathNodeIds: string[]): number {
  let total = 0;
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const from = pathNodeIds[i];
    const to = pathNodeIds[i + 1];
    const edge = (graph.adjacency.get(from) ?? []).find((neighbor) => neighbor.to === to);
    if (!edge) {
      throw new Error(`No edge between consecutive path nodes ${from} -> ${to}`);
    }
    total += edge.distance;
  }
  return total;
}

/** Count of nodes revisited along the path - a walker passing back through an already-traversed node. */
export function computeBacktrackCount(pathNodeIds: string[]): number {
  const seen = new Set<string>();
  let backtrackCount = 0;
  for (const nodeId of pathNodeIds) {
    if (seen.has(nodeId)) backtrackCount += 1;
    seen.add(nodeId);
  }
  return backtrackCount;
}
