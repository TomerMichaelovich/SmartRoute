import type { Graph } from "./graph-builder";

interface HeapEntry {
  nodeId: string;
  distance: number;
}

/** Binary min-heap keyed by distance - all a Dijkstra implementation needs from a heap. */
class MinHeap {
  private items: HeapEntry[] = [];

  get size(): number {
    return this.items.length;
  }

  push(entry: HeapEntry): void {
    this.items.push(entry);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapEntry | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].distance <= this.items[index].distance) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  private bubbleDown(index: number): void {
    const n = this.items.length;
    for (;;) {
      const left = index * 2 + 1;
      const right = index * 2 + 2;
      let smallest = index;
      if (left < n && this.items[left].distance < this.items[smallest].distance) smallest = left;
      if (right < n && this.items[right].distance < this.items[smallest].distance)
        smallest = right;
      if (smallest === index) return;
      [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
      index = smallest;
    }
  }
}

export interface DijkstraResult {
  distances: Map<string, number>;
  previous: Map<string, string | null>;
}

/** Single-source shortest paths, O((V+E) log V). Instant at store-graph scale (10-20 nodes). */
export function dijkstra(graph: Graph, sourceId: string): DijkstraResult {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  }
  distances.set(sourceId, 0);

  const heap = new MinHeap();
  heap.push({ nodeId: sourceId, distance: 0 });
  const visited = new Set<string>();

  while (heap.size > 0) {
    const current = heap.pop()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    for (const { to, distance } of graph.adjacency.get(current.nodeId) ?? []) {
      if (visited.has(to)) continue;
      const candidate = current.distance + distance;
      if (candidate < (distances.get(to) ?? Infinity)) {
        distances.set(to, candidate);
        previous.set(to, current.nodeId);
        heap.push({ nodeId: to, distance: candidate });
      }
    }
  }

  return { distances, previous };
}

/** Reconstructs the node path to `targetId` from an already-computed Dijkstra result. */
export function reconstructPath(
  previous: Map<string, string | null>,
  targetId: string,
): string[] {
  const path: string[] = [];
  let current: string | null = targetId;
  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }
  return path;
}

export interface ShortestPath {
  distance: number;
  path: string[];
}

export function shortestPath(graph: Graph, fromId: string, toId: string): ShortestPath {
  const { distances, previous } = dijkstra(graph, fromId);
  const distance = distances.get(toId) ?? Infinity;
  if (!Number.isFinite(distance)) return { distance: Infinity, path: [] };
  return { distance, path: reconstructPath(previous, toId) };
}
