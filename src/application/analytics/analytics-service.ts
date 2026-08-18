import type { AnalyticsEvent } from "@/src/domain/entities/analytics-event";

/**
 * Aggregates computed on demand over the event log - adequate at MVP data
 * volumes (no separate analytics DB or batch jobs, per the plan). Each
 * function takes the already-read event array rather than reading the
 * repository itself, so callers control when/how often the (potentially
 * large) log is read.
 */

export function getClassificationAccuracy(events: AnalyticsEvent[]): number {
  const classified = events.filter((e) => e.type === "item_classified");
  if (classified.length === 0) return 0;
  const confident = classified.filter((e) => {
    const confidence = e.payload.confidence;
    return typeof confidence === "number" && confidence >= 0.85;
  });
  return confident.length / classified.length;
}

export function getAverageShoppingDurationSeconds(events: AnalyticsEvent[]): number {
  const completions = events.filter((e) => e.type === "route_completed");
  if (completions.length === 0) return 0;
  const durations = completions
    .map((e) => e.payload.durationSeconds)
    .filter((d): d is number => typeof d === "number");
  if (durations.length === 0) return 0;
  return durations.reduce((sum, d) => sum + d, 0) / durations.length;
}

export interface PromotionStats {
  promotionId: string;
  impressions: number;
  clicks: number;
}

export function getPromotionStats(events: AnalyticsEvent[]): PromotionStats[] {
  const statsById = new Map<string, PromotionStats>();

  function getEntry(promotionId: string): PromotionStats {
    let entry = statsById.get(promotionId);
    if (!entry) {
      entry = { promotionId, impressions: 0, clicks: 0 };
      statsById.set(promotionId, entry);
    }
    return entry;
  }

  for (const event of events) {
    const promotionId = event.payload.promotionId;
    if (typeof promotionId !== "string") continue;
    if (event.type === "promotion_impression") getEntry(promotionId).impressions += 1;
    if (event.type === "promotion_click") getEntry(promotionId).clicks += 1;
  }

  return Array.from(statsById.values());
}

/** Sessions with a route_started event on more than one distinct calendar day. */
export function getReturningSessionCount(events: AnalyticsEvent[]): number {
  const daysBySession = new Map<string, Set<string>>();
  for (const event of events) {
    if (event.type !== "route_started") continue;
    const day = event.timestamp.slice(0, 10);
    const days = daysBySession.get(event.sessionId) ?? new Set<string>();
    days.add(day);
    daysBySession.set(event.sessionId, days);
  }
  return Array.from(daysBySession.values()).filter((days) => days.size > 1).length;
}

/**
 * Physical findability: of the item-level actions a shopper takes while walking
 * the route (checked off, or reported not-found), what fraction end up reported
 * not-found? Distinct from classification accuracy - this catches cases where the
 * text-to-product match was correct but the map/shelf location was wrong.
 */
export function getNotFoundRate(events: AnalyticsEvent[]): number {
  const latestByItem = new Map<string, boolean>();
  for (const event of events) {
    if (event.type !== "item_checked" && event.type !== "item_not_found") continue;
    const itemId = event.payload.itemId;
    if (typeof itemId !== "string") continue;
    latestByItem.set(itemId, event.type === "item_not_found" && event.payload.notFound === true);
  }
  if (latestByItem.size === 0) return 0;
  const notFoundCount = Array.from(latestByItem.values()).filter(Boolean).length;
  return notFoundCount / latestByItem.size;
}

export function countImpressionsForSession(
  events: AnalyticsEvent[],
  sessionId: string,
  promotionId: string,
): number {
  return events.filter(
    (e) =>
      e.type === "promotion_impression" &&
      e.sessionId === sessionId &&
      e.payload.promotionId === promotionId,
  ).length;
}
