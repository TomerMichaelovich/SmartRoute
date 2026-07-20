import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { Product } from "@/src/domain/entities/product";
import type { Route, RouteStop } from "@/src/domain/entities/route";
import type { ShoppingListItem } from "@/src/domain/entities/shopping-list";
import { buildGraph } from "./graph-builder";
import { dijkstra, reconstructPath, type DijkstraResult } from "./dijkstra";
import { nearestNeighborOrder } from "./nearest-neighbor-tsp";
import { computeBacktrackCount, computeTotalDistance } from "./route-metrics";
import { twoOptImprove } from "./two-opt";

export interface BuildRouteParams {
  routeId: string;
  storeId: string;
  shoppingListId: string;
  items: ShoppingListItem[];
  products: Product[];
  nodes: MapNode[];
  edges: MapEdge[];
}

/**
 * Resolves classified shopping-list items to store locations, orders the
 * stops (nearest-neighbor + 2-opt), and reconstructs the full walked path
 * entrance -> stops -> checkout via Dijkstra shortest paths between them.
 */
export function buildRoute(params: BuildRouteParams): Route {
  const { routeId, storeId, shoppingListId, items, products, nodes, edges } = params;
  const graph = buildGraph(nodes, edges);

  const entrance = nodes.find((n) => n.type === "entrance");
  const checkout = nodes.find((n) => n.type === "checkout");
  if (!entrance || !checkout) {
    throw new Error(`Store ${storeId} is missing an entrance or checkout node`);
  }

  const productById = new Map(products.map((p) => [p.id, p]));
  const itemsByNode = new Map<string, string[]>();
  const unresolvedItemIds: string[] = [];

  for (const item of items) {
    const productId = item.classification?.matchedProductId;
    const product = productId ? productById.get(productId) : undefined;
    const location = product?.locations.find((loc) => loc.storeId === storeId);
    if (!location) {
      unresolvedItemIds.push(item.id);
      continue;
    }
    const existing = itemsByNode.get(location.nodeId) ?? [];
    existing.push(item.id);
    itemsByNode.set(location.nodeId, existing);
  }

  const stopNodeIds = Array.from(itemsByNode.keys());
  const createdAt = new Date().toISOString();

  if (stopNodeIds.length === 0) {
    return {
      id: routeId,
      storeId,
      shoppingListId,
      stops: [],
      pathNodeIds: [],
      totalDistanceMeters: 0,
      backtrackCount: 0,
      unresolvedItemIds,
      createdAt,
    };
  }

  // One Dijkstra run per key node (entrance, each stop, checkout) gives every
  // pairwise distance/path needed for ordering and path reconstruction.
  const keyNodeIds = [entrance.id, ...stopNodeIds, checkout.id];
  const dijkstraByNode = new Map<string, DijkstraResult>();
  for (const nodeId of keyNodeIds) {
    dijkstraByNode.set(nodeId, dijkstra(graph, nodeId));
  }

  const distanceBetween = (a: string, b: string): number =>
    dijkstraByNode.get(a)?.distances.get(b) ?? Infinity;

  const initialOrder = nearestNeighborOrder(entrance.id, stopNodeIds, distanceBetween);
  const optimizedOrder = twoOptImprove(entrance.id, checkout.id, initialOrder, distanceBetween);

  const fullSequence = [entrance.id, ...optimizedOrder, checkout.id];
  const pathNodeIds: string[] = [];
  for (let i = 0; i < fullSequence.length - 1; i++) {
    const from = fullSequence[i];
    const to = fullSequence[i + 1];
    const segment = reconstructPath(dijkstraByNode.get(from)!.previous, to);
    pathNodeIds.push(...(i === 0 ? segment : segment.slice(1)));
  }

  const stops: RouteStop[] = optimizedOrder.map((nodeId, index) => {
    const mapNode = graph.nodes.get(nodeId)!;
    return {
      order: index + 1,
      nodeId,
      itemIds: itemsByNode.get(nodeId) ?? [],
      label: mapNode.label,
      type: mapNode.type,
    };
  });

  return {
    id: routeId,
    storeId,
    shoppingListId,
    stops,
    pathNodeIds,
    totalDistanceMeters: computeTotalDistance(graph, pathNodeIds),
    backtrackCount: computeBacktrackCount(pathNodeIds),
    unresolvedItemIds,
    createdAt,
  };
}
