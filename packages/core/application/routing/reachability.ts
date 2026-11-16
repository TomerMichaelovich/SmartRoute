import type { MapEdge } from "@smartroute/core/domain/entities/map-edge";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";

/** Where a route can never continue from: shopping ends at a checkout, and an exit is beyond it. */
export function isRouteEnd(node: Pick<MapNode, "type">): boolean {
  return node.type === "checkout" || node.type === "exit";
}

/** The node a route starts from - the same choice route building makes. */
export function routeEntrance(nodes: readonly MapNode[]): MapNode | undefined {
  return nodes.find((n) => n.type === "entrance");
}

/**
 * The nodes a shopping route can't use, judged exactly as route building walks the graph: from
 * the route's entrance, along edges in their allowed direction, never continuing out of a
 * checkout or an exit. The stretch past the checkouts (the way out, e.g. to an exit) is
 * expected to be unreachable for shopping, so its waypoints and exits aren't reported; a
 * department, entrance or checkout out of reach always is. With no entrance, nothing is.
 */
export function findUnroutableNodeIds(nodes: readonly MapNode[], edges: readonly MapEdge[]): Set<string> {
  const entrance = routeEntrance(nodes);
  if (!entrance) return new Set();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const next = new Map<string, string[]>();
  const link = (from: string, to: string) => next.set(from, [...(next.get(from) ?? []), to]);
  for (const e of edges) {
    if (!byId.has(e.fromNodeId) || !byId.has(e.toNodeId)) continue;
    link(e.fromNodeId, e.toNodeId);
    if (e.bidirectional) link(e.toNodeId, e.fromNodeId);
  }

  // Everything a route can reach.
  const routable = new Set([entrance.id]);
  const queue = [entrance.id];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (isRouteEnd(byId.get(id)!)) continue;
    for (const to of next.get(id) ?? []) {
      if (!routable.has(to)) {
        routable.add(to);
        queue.push(to);
      }
    }
  }

  // The way out past the checkouts: reached from a checkout without going back into the store.
  const pastCheckout = new Set<string>();
  const out = nodes.filter((n) => n.type === "checkout" && routable.has(n.id)).map((n) => n.id);
  while (out.length > 0) {
    const id = out.pop()!;
    if (byId.get(id)!.type === "exit") continue;
    for (const to of next.get(id) ?? []) {
      if (!routable.has(to) && !pastCheckout.has(to)) {
        pastCheckout.add(to);
        out.push(to);
      }
    }
  }

  return new Set(
    nodes
      .filter((n) => !routable.has(n.id))
      .filter((n) => !(pastCheckout.has(n.id) && (n.type === "waypoint" || n.type === "exit")))
      .map((n) => n.id),
  );
}
