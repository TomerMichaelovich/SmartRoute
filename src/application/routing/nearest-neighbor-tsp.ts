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
    // `remaining` is non-empty, so a nearest candidate always exists.
    order.push(nearest!);
    remaining.delete(nearest!);
    current = nearest!;
  }

  return order;
}
