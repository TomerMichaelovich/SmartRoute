import type { AnalyticsEvent } from "@/src/domain/entities/analytics-event";
import type { Promotion } from "@/src/domain/entities/promotion";
import type { Route } from "@/src/domain/entities/route";
import { countImpressionsForSession } from "@/src/application/analytics/analytics-service";

const MAX_PROMOTIONS_PER_ROUTE = 2;

export interface SelectRoutePromotionsOptions {
  /** Analytics session id + prior events, used to enforce frequencyCapPerSession. Omit to skip that check (e.g. no session cookie yet). */
  session?: { sessionId: string; priorEvents: AnalyticsEvent[] };
  now?: Date;
}

/**
 * Filters promotions down to the handful that genuinely belong on this route:
 * active, in date range, matching store (or chain-wide), attached to a node
 * the shopper actually walks past, and under that session's per-promotion
 * frequency cap - then caps the total shown so promotions stay a light
 * touch, never a wall of offers.
 */
export function selectRoutePromotions(
  route: Route,
  allPromotions: Promotion[],
  promotionsEnabled: boolean,
  options: SelectRoutePromotionsOptions = {},
): Promotion[] {
  if (!promotionsEnabled) return [];

  const now = options.now ?? new Date();
  const pathNodeIds = new Set(route.pathNodeIds);

  const eligible = allPromotions.filter((promo) => {
    if (!promo.isActive) return false;
    if (promo.storeId && promo.storeId !== route.storeId) return false;
    if (promo.startDate && new Date(promo.startDate) > now) return false;
    if (promo.endDate && new Date(promo.endDate) < now) return false;
    if (!pathNodeIds.has(promo.attachedNodeId)) return false;

    if (options.session) {
      const priorImpressions = countImpressionsForSession(
        options.session.priorEvents,
        options.session.sessionId,
        promo.id,
      );
      if (priorImpressions >= promo.frequencyCapPerSession) return false;
    }

    return true;
  });

  return eligible.slice(0, MAX_PROMOTIONS_PER_ROUTE);
}
