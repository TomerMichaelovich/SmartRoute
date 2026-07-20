import type { DistanceFn } from "./nearest-neighbor-tsp";

const MAX_PASSES = 200;
const IMPROVEMENT_EPSILON = 1e-9;

function sequenceDistance(entranceId: string, checkoutId: string, order: string[], distanceBetween: DistanceFn): number {
  const sequence = [entranceId, ...order, checkoutId];
  let total = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    total += distanceBetween(sequence[i], sequence[i + 1]);
  }
  return total;
}

/**
 * Repeatedly reverses sub-segments of the stop order (entrance/checkout fixed
 * at the ends) whenever it shortens the total walked distance, until no
 * improving swap remains or MAX_PASSES is hit. Cleans up nearest-neighbor's
 * typical worst mistakes without the complexity of an exact TSP solver -
 * unnecessary at MVP scale (<=40 stops) for a quality gain no shopper would
 * notice on the store floor.
 */
export function twoOptImprove(
  entranceId: string,
  checkoutId: string,
  initialOrder: string[],
  distanceBetween: DistanceFn,
): string[] {
  let order = [...initialOrder];
  if (order.length < 2) return order;

  let improved = true;
  let passes = 0;

  while (improved && passes < MAX_PASSES) {
    improved = false;
    passes += 1;
    const currentDistance = sequenceDistance(entranceId, checkoutId, order, distanceBetween);

    for (let i = 0; i < order.length - 1; i++) {
      for (let j = i + 1; j < order.length; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        const candidateDistance = sequenceDistance(entranceId, checkoutId, candidate, distanceBetween);
        if (candidateDistance < currentDistance - IMPROVEMENT_EPSILON) {
          order = candidate;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  return order;
}
