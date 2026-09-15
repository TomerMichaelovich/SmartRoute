export type DistanceFn = (a: string, b: string) => number;

/**
 * Greedy nearest-neighbor construction for an open path: fixed start at
 * entrance, visits the nearest not-yet-visited stop each step. Returns only
 * the stop ordering (entrance/checkout are not included).
 */
export function nearestNeighborOrder(
  entranceId: string,
  stopIds: string[],
  distanceBetween: DistanceFn,
): string[] {
  const remaining = new Set(stopIds);
  const order: string[] = [];
  let current = entranceId;

  while (remaining.size > 0) {
    let nearest: string | null = null;
    let nearestDistance = Infinity;
    for (const candidate of remaining) {
      const d = distanceBetween(current, candidate);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = candidate;
      }
    }
    if (nearest === null) {
      // Every remaining stop is unreachable from `current` - a gap in the store's node
      // graph (missing edges), not a transient failure. Without this guard the loop
      // never shrinks `remaining` and spins until the array push overflows.
      throw new Error(`No path from ${current} to any of: ${Array.from(remaining).join(", ")}`);
    }
    order.push(nearest);
    remaining.delete(nearest);
    current = nearest;
  }

  return order;
}
