import type { Promotion } from "@/src/domain/entities/promotion";
import type { Route } from "@/src/domain/entities/route";

const MAX_PROMOTIONS_PER_ROUTE = 2;

/**
 * Filters promotions down to the handful that genuinely belong on this route:
 * active, in date range, matching store (or chain-wide), and attached to a
 * node the shopper actually walks past - then caps the total shown so
 * promotions stay a light touch, never a wall of offers. Per-session
 * frequency capping (Promotion.frequencyCapPerSession) is enforced where the
 * analytics event log is available (see the route screen), since it needs a
 * session's prior impression history.
 */
export function selectRoutePromotions(
  route: Route,
  allPromotions: Promotion[],
  promotionsEnabled: boolean,
  now: Date = new Date(),
): Promotion[] {
  if (!promotionsEnabled) return [];

  const pathNodeIds = new Set(route.pathNodeIds);

  const eligible = allPromotions.filter((promo) => {
    if (!promo.isActive) return false;
    if (promo.storeId && promo.storeId !== route.storeId) return false;
    if (promo.startDate && new Date(promo.startDate) > now) return false;
    if (promo.endDate && new Date(promo.endDate) < now) return false;
    return pathNodeIds.has(promo.attachedNodeId);
  });

  return eligible.slice(0, MAX_PROMOTIONS_PER_ROUTE);
}
