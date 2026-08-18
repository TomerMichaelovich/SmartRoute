import { describe, expect, it } from "vitest";
import {
  countImpressionsForSession,
  getAverageShoppingDurationSeconds,
  getClassificationAccuracy,
  getNotFoundRate,
  getPromotionStats,
  getReturningSessionCount,
} from "@/src/application/analytics/analytics-service";
import type { AnalyticsEvent } from "@/src/domain/entities/analytics-event";

function event(overrides: Partial<AnalyticsEvent> & Pick<AnalyticsEvent, "type">): AnalyticsEvent {
  return {
    id: crypto.randomUUID(),
    sessionId: "session-1",
    payload: {},
    timestamp: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("getClassificationAccuracy", () => {
  it("returns 0 when there are no classification events", () => {
    expect(getClassificationAccuracy([])).toBe(0);
  });

  it("is the fraction of classifications with confidence >= 0.85", () => {
    const events = [
      event({ type: "item_classified", payload: { confidence: 1 } }),
      event({ type: "item_classified", payload: { confidence: 0.9 } }),
      event({ type: "item_classified", payload: { confidence: 0.5 } }),
      event({ type: "item_classified", payload: { confidence: 0 } }),
    ];
    expect(getClassificationAccuracy(events)).toBe(0.5);
  });
});

describe("getAverageShoppingDurationSeconds", () => {
  it("returns 0 when there are no completions", () => {
    expect(getAverageShoppingDurationSeconds([])).toBe(0);
  });

  it("averages durationSeconds across route_completed events", () => {
    const events = [
      event({ type: "route_completed", payload: { durationSeconds: 100 } }),
      event({ type: "route_completed", payload: { durationSeconds: 200 } }),
    ];
    expect(getAverageShoppingDurationSeconds(events)).toBe(150);
  });
});

describe("getPromotionStats", () => {
  it("counts impressions and clicks per promotion", () => {
    const events = [
      event({ type: "promotion_impression", payload: { promotionId: "p1" } }),
      event({ type: "promotion_impression", payload: { promotionId: "p1" } }),
      event({ type: "promotion_click", payload: { promotionId: "p1" } }),
      event({ type: "promotion_impression", payload: { promotionId: "p2" } }),
    ];
    const stats = getPromotionStats(events);
    expect(stats).toEqual(
      expect.arrayContaining([
        { promotionId: "p1", impressions: 2, clicks: 1 },
        { promotionId: "p2", impressions: 1, clicks: 0 },
      ]),
    );
  });
});

describe("getReturningSessionCount", () => {
  it("counts sessions with route_started on more than one distinct day", () => {
    const events = [
      event({ type: "route_started", sessionId: "s1", timestamp: "2026-01-01T10:00:00.000Z" }),
      event({ type: "route_started", sessionId: "s1", timestamp: "2026-01-02T10:00:00.000Z" }),
      event({ type: "route_started", sessionId: "s2", timestamp: "2026-01-01T10:00:00.000Z" }),
      event({ type: "route_started", sessionId: "s2", timestamp: "2026-01-01T15:00:00.000Z" }),
    ];
    expect(getReturningSessionCount(events)).toBe(1);
  });
});

describe("getNotFoundRate", () => {
  it("returns 0 when there are no item actions", () => {
    expect(getNotFoundRate([])).toBe(0);
  });

  it("counts each item once, by its most recent action", () => {
    const events = [
      event({ type: "item_checked", timestamp: "2026-01-01T00:00:00.000Z", payload: { itemId: "a", checked: true } }),
      event({ type: "item_not_found", timestamp: "2026-01-01T00:01:00.000Z", payload: { itemId: "b", notFound: true } }),
      // "c" is reported not-found, then found after all - the later action wins.
      event({ type: "item_not_found", timestamp: "2026-01-01T00:02:00.000Z", payload: { itemId: "c", notFound: true } }),
      event({ type: "item_checked", timestamp: "2026-01-01T00:03:00.000Z", payload: { itemId: "c", checked: true } }),
    ];
    expect(getNotFoundRate(events)).toBe(1 / 3);
  });
});

describe("countImpressionsForSession", () => {
  it("counts only matching sessionId + promotionId impressions", () => {
    const events = [
      event({ type: "promotion_impression", sessionId: "s1", payload: { promotionId: "p1" } }),
      event({ type: "promotion_impression", sessionId: "s1", payload: { promotionId: "p1" } }),
      event({ type: "promotion_impression", sessionId: "s1", payload: { promotionId: "p2" } }),
      event({ type: "promotion_impression", sessionId: "s2", payload: { promotionId: "p1" } }),
      event({ type: "promotion_click", sessionId: "s1", payload: { promotionId: "p1" } }),
    ];
    expect(countImpressionsForSession(events, "s1", "p1")).toBe(2);
  });
});
