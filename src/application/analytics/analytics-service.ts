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

/** Average of submitted post-trip satisfaction ratings (1-5), or 0 if none. */
export function getAverageSatisfactionRating(events: AnalyticsEvent[]): number {
  const ratings = events
    .filter((e) => e.type === "satisfaction_rating")
    .map((e) => e.payload.rating)
    .filter((r): r is number => typeof r === "number");
  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
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

export interface AnalyticsFilter {
  storeId?: string;
  /** Inclusive, "YYYY-MM-DD". */
  from?: string;
  /** Inclusive, "YYYY-MM-DD". */
  to?: string;
}

export function filterEvents(events: AnalyticsEvent[], filter: AnalyticsFilter): AnalyticsEvent[] {
  return events.filter((e) => {
    if (filter.storeId && e.storeId !== filter.storeId) return false;
    const day = e.timestamp.slice(0, 10);
    if (filter.from && day < filter.from) return false;
    if (filter.to && day > filter.to) return false;
    return true;
  });
}

/** Every "YYYY-MM-DD" day from `from` to `to`, inclusive. */
export function enumerateDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export interface DailyPoint {
  date: string;
  value: number;
}

/**
 * Groups `events` by day and calls `computeValue` once per entry in `days` -
 * including days with no matching events (computeValue([])) - so charts built
 * from the result don't draw a misleading connecting line across a gap.
 */
export function buildDailySeries(
  events: AnalyticsEvent[],
  days: string[],
  computeValue: (dayEvents: AnalyticsEvent[]) => number,
): DailyPoint[] {
  const eventsByDay = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const day = event.timestamp.slice(0, 10);
    const bucket = eventsByDay.get(day);
    if (bucket) bucket.push(event);
    else eventsByDay.set(day, [event]);
  }
  return days.map((date) => ({ date, value: computeValue(eventsByDay.get(date) ?? []) }));
}

/** Day-by-day analog of getNotFoundRate - "latest action per item" is scoped to each day. */
export function getNotFoundRateSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  const itemEvents = events.filter((e) => e.type === "item_checked" || e.type === "item_not_found");
  return buildDailySeries(itemEvents, days, (dayEvents) => {
    const latestByItem = new Map<string, boolean>();
    for (const event of dayEvents) {
      const itemId = event.payload.itemId;
      if (typeof itemId !== "string") continue;
      latestByItem.set(itemId, event.type === "item_not_found" && event.payload.notFound === true);
    }
    if (latestByItem.size === 0) return 0;
    const notFoundCount = Array.from(latestByItem.values()).filter(Boolean).length;
    return notFoundCount / latestByItem.size;
  });
}

export function getAverageShoppingDurationSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  const completions = events.filter((e) => e.type === "route_completed");
  return buildDailySeries(completions, days, (dayEvents) => {
    const durations = dayEvents
      .map((e) => e.payload.durationSeconds)
      .filter((d): d is number => typeof d === "number");
    if (durations.length === 0) return 0;
    return durations.reduce((sum, d) => sum + d, 0) / durations.length;
  });
}

export function getAverageSatisfactionSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  const ratings = events.filter((e) => e.type === "satisfaction_rating");
  return buildDailySeries(ratings, days, (dayEvents) => {
    const values = dayEvents.map((e) => e.payload.rating).filter((r): r is number => typeof r === "number");
    if (values.length === 0) return 0;
    return values.reduce((sum, r) => sum + r, 0) / values.length;
  });
}

export function getClassificationAccuracySeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  const classified = events.filter((e) => e.type === "item_classified");
  return buildDailySeries(classified, days, (dayEvents) => {
    if (dayEvents.length === 0) return 0;
    const confident = dayEvents.filter((e) => {
      const confidence = e.payload.confidence;
      return typeof confidence === "number" && confidence >= 0.85;
    });
    return confident.length / dayEvents.length;
  });
}

export function getRouteStartedCountSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  return buildDailySeries(
    events.filter((e) => e.type === "route_started"),
    days,
    (dayEvents) => dayEvents.length,
  );
}

export function getRouteCompletedCountSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  return buildDailySeries(
    events.filter((e) => e.type === "route_completed"),
    days,
    (dayEvents) => dayEvents.length,
  );
}

export function getPromotionImpressionCountSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  return buildDailySeries(
    events.filter((e) => e.type === "promotion_impression"),
    days,
    (dayEvents) => dayEvents.length,
  );
}

export function getPromotionClickCountSeries(events: AnalyticsEvent[], days: string[]): DailyPoint[] {
  return buildDailySeries(
    events.filter((e) => e.type === "promotion_click"),
    days,
    (dayEvents) => dayEvents.length,
  );
}
