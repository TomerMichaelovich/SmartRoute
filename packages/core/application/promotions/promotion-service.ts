import type { AnalyticsEvent } from "@smartroute/core/domain/entities/analytics-event";
import type { Promotion } from "@smartroute/core/domain/entities/promotion";
import type { Route } from "@smartroute/core/domain/entities/route";
import { countImpressionsForSession } from "@smartroute/core/application/analytics/analytics-service";

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
    // endDate is stored as midnight UTC of the chosen calendar day (a date
    // picker only carries a day, not a time) - "ends 20/9" has to mean
    // "still runs all through the 20th", i.e. up to (but not including)
    // midnight UTC of the *next* day. Comparing against the start of endDate
    // itself would make the promotion vanish at the very first instant of
    // the day the admin meant to keep it running.
    if (promo.endDate) {
      const endOfDay = new Date(promo.endDate).getTime() + 24 * 60 * 60 * 1000;
      if (now.getTime() >= endOfDay) return false;
    }
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
