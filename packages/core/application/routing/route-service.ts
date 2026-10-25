import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import type { Route, RouteStop } from "@smartroute/core/domain/entities/route";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
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
  listings: ProductListing[];
  nodes: MapNode[];
  edges: MapEdge[];
  mapWidth: number;
  mapHeight: number;
  /**
   * Re-planning mid-shop (e.g. a shared-list participant added items): the items already
   * collected, in the order they were ticked. Stops whose items are all collected keep that
   * walked order up front, and only the rest is optimized - starting from the last of them,
   * where the shopper is now, rather than from the entrance.
   */
  completedItemIds?: string[];
  /** Items the shopper decided not to buy here - left out of the route like unresolved ones. */
  skippedItemIds?: string[];
  /**
   * Re-planning mid-shop: the stop the shopper is currently walking to. It stays the next
   * stop, and everything else still to do is optimized from there - so an item added at a
   * department already passed is fitted in after it, never as a sudden U-turn.
   */
  nextStopNodeId?: string;
}

/**
 * For items several products could stand for here (see placeDecisions), the
 * product whose shelf makes the walk shortest: a shelf the route stops at
 * anyway costs nothing; otherwise the cheapest detour into the route planned
 * for everything else (entrance -> stops -> checkout). Decided one item at a
 * time, each joining the route for the next.
 */
export function choosePlaces(params: {
  storeId: string;
  items: ShoppingListItem[];
  flexible: Map<string, string[]>;
  listings: ProductListing[];
  nodes: MapNode[];
  edges: MapEdge[];
  mapWidth: number;
  mapHeight: number;
}): Map<string, string> {
  const { storeId, items, flexible, listings, nodes, edges, mapWidth, mapHeight } = params;
  const chosen = new Map<string, string>();
  if (flexible.size === 0) return chosen;
  const graph = buildGraph(nodes, edges, mapWidth, mapHeight);
  const entrance = nodes.find((n) => n.type === "entrance");
  const checkout = nodes.find((n) => n.type === "checkout");
  const nodeOf = (productId: string | undefined) => {
    const listing = productId ? listings.find((l) => l.productId === productId && l.storeId === storeId) : undefined;
    return listing && graph.nodes.has(listing.nodeId) ? listing.nodeId : null;
  };

  const stops = new Set<string>();
  for (const item of items) {
    if (flexible.has(item.id) || item.checked) continue;
    const node = nodeOf(item.classification?.matchedProductId);
    if (node) stops.add(node);
  }

  // A shelf already on the way wins outright.
  const pending: { itemId: string; options: { productId: string; nodeId: string }[] }[] = [];
  for (const [itemId, productIds] of flexible) {
    const options = productIds.flatMap((productId) => {
      const nodeId = nodeOf(productId);
      return nodeId ? [{ productId, nodeId }] : [];
    });
    if (options.length === 0) continue;
    const onTheWay = options.find((o) => stops.has(o.nodeId));
    if (onTheWay || options.length === 1 || !entrance || !checkout) {
      const pick = onTheWay ?? options[0];
      chosen.set(itemId, pick.productId);
      stops.add(pick.nodeId);
    } else {
      pending.push({ itemId, options });
    }
  }
  if (pending.length === 0 || !entrance || !checkout) return chosen;

  const dijkstraByNode = new Map<string, DijkstraResult>();
  const distanceBetween = (a: string, b: string): number => {
    if (!dijkstraByNode.has(a)) dijkstraByNode.set(a, dijkstra(graph, a));
    return dijkstraByNode.get(a)!.distances.get(b) ?? Infinity;
  };
  let order = twoOptImprove(entrance.id, checkout.id, nearestNeighborOrder(entrance.id, [...stops], distanceBetween), distanceBetween);
  for (const { itemId, options } of pending) {
    const onTheWay = options.find((o) => stops.has(o.nodeId));
    let best = onTheWay ? { ...onTheWay, cost: 0, at: -1 } : null;
    if (!best) {
      const sequence = [entrance.id, ...order, checkout.id];
      for (const option of options) {
        for (let i = 0; i < sequence.length - 1; i++) {
          const cost =
            distanceBetween(sequence[i], option.nodeId) + distanceBetween(option.nodeId, sequence[i + 1]) - distanceBetween(sequence[i], sequence[i + 1]);
          if (!best || cost < best.cost) best = { ...option, cost, at: i };
        }
      }
    }
    chosen.set(itemId, best!.productId);
    if (!stops.has(best!.nodeId)) {
      stops.add(best!.nodeId);
      order = [...order.slice(0, best!.at), best!.nodeId, ...order.slice(best!.at)];
    }
  }
  return chosen;
}

/**
 * Resolves classified shopping-list items to store locations, orders the
 * stops (nearest-neighbor + 2-opt), and reconstructs the full walked path
 * entrance -> stops -> checkout via Dijkstra shortest paths between them.
 */
export function buildRoute(params: BuildRouteParams): Route {
  const {
    routeId,
    storeId,
    shoppingListId,
    items,
    listings,
    nodes,
    edges,
    mapWidth,
    mapHeight,
    completedItemIds = [],
    skippedItemIds = [],
    nextStopNodeId,
  } = params;
  const skipped = new Set(skippedItemIds);
  const graph = buildGraph(nodes, edges, mapWidth, mapHeight);

  const entrance = nodes.find((n) => n.type === "entrance");
  const checkout = nodes.find((n) => n.type === "checkout");
  if (!entrance || !checkout) {
    throw new Error(`Store ${storeId} is missing an entrance or checkout node`);
  }

  const itemsByNode = new Map<string, string[]>();
  const unresolvedItemIds: string[] = [];

  for (const item of items) {
    const productId = item.classification?.matchedProductId;
    const listing = productId
      ? listings.find((l) => l.productId === productId && l.storeId === storeId)
      : undefined;
    // A listing whose node was deleted from the map can't be routed to - treat the item like
    // one the store doesn't carry instead of failing the whole route.
    if (!listing || !graph.nodes.has(listing.nodeId) || skipped.has(item.id)) {
      unresolvedItemIds.push(item.id);
      continue;
    }
    const existing = itemsByNode.get(listing.nodeId) ?? [];
    existing.push(item.id);
    itemsByNode.set(listing.nodeId, existing);
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
      checkoutPathNodeIds: [],
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

  // Stops already fully collected stay first, in the order they were finished; a stop with
  // anything left on it (e.g. a new item at a visited shelf) is still ahead of the shopper.
  const tickOrder = new Map(completedItemIds.map((id, index) => [id, index]));
  const lastTick = (nodeId: string) => Math.max(...itemsByNode.get(nodeId)!.map((id) => tickOrder.get(id) ?? -1));
  const doneNodeIds = stopNodeIds
    .filter((nodeId) => itemsByNode.get(nodeId)!.every((id) => tickOrder.has(id)))
    .sort((a, b) => lastTick(a) - lastTick(b));
  const doneSet = new Set(doneNodeIds);
  // The stop being walked to (if still to do) is kept next and the rest is planned from it;
  // otherwise planning starts where the shopper last finished.
  const heading = nextStopNodeId && !doneSet.has(nextStopNodeId) && itemsByNode.has(nextStopNodeId) ? nextStopNodeId : null;
  const remainingNodeIds = stopNodeIds.filter((nodeId) => !doneSet.has(nodeId) && nodeId !== heading);
  const start = heading ?? doneNodeIds.at(-1) ?? entrance.id;

  const initialOrder = nearestNeighborOrder(start, remainingNodeIds, distanceBetween);
  const optimizedOrder = [
    ...doneNodeIds,
    ...(heading ? [heading] : []),
    ...twoOptImprove(start, checkout.id, initialOrder, distanceBetween),
  ];

  const fullSequence = [entrance.id, ...optimizedOrder, checkout.id];
  const pathNodeIds: string[] = [];
  // One segment per leg of fullSequence (entrance->stop1, stop1->stop2, ..., lastStop->checkout) -
  // kept individually (not just concatenated into pathNodeIds) so each stop can carry only the
  // leg leading up to it, letting the customer-facing map show "route to the next product" instead
  // of the whole walked path at once.
  const segments: string[][] = [];
  for (let i = 0; i < fullSequence.length - 1; i++) {
    const from = fullSequence[i];
    const to = fullSequence[i + 1];
    const segment = reconstructPath(dijkstraByNode.get(from)!.previous, to);
    segments.push(segment);
    pathNodeIds.push(...(i === 0 ? segment : segment.slice(1)));
  }
  const checkoutPathNodeIds = segments[segments.length - 1];

  const stops: RouteStop[] = optimizedOrder.map((nodeId, index) => {
    const mapNode = graph.nodes.get(nodeId)!;
    return {
      order: index + 1,
      nodeId,
      itemIds: itemsByNode.get(nodeId) ?? [],
      label: mapNode.label,
      type: mapNode.type,
      pathFromPrevious: segments[index],
      // Lets the UI route to checkout from whichever stop the shopper actually
      // finishes at last, rather than only from the stop that's last in TSP order.
      pathToCheckout: reconstructPath(dijkstraByNode.get(nodeId)!.previous, checkout.id),
    };
  });

  return {
    id: routeId,
    storeId,
    shoppingListId,
    stops,
    pathNodeIds,
    checkoutPathNodeIds,
    totalDistanceMeters: computeTotalDistance(graph, pathNodeIds),
    backtrackCount: computeBacktrackCount(pathNodeIds),
    unresolvedItemIds,
    createdAt,
  };
}
