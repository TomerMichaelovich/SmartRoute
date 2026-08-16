import { describe, expect, it } from "vitest";
import { selectRoutePromotions } from "@/src/application/promotions/promotion-service";
import type { Promotion } from "@/src/domain/entities/promotion";
import type { Route } from "@/src/domain/entities/route";

function baseRoute(overrides: Partial<Route> = {}): Route {
  return {
    id: "r-1",
    storeId: "store-1",
    shoppingListId: "sl-1",
    stops: [],
    pathNodeIds: ["n-entrance", "n-dairy", "n-beverages", "n-checkout"],
    checkoutPathNodeIds: [],
    totalDistanceMeters: 50,
    backtrackCount: 0,
    unresolvedItemIds: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function basePromo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: "promo-1",
    chainId: "chain-1",
    storeId: "store-1",
    title: "Test promo",
    description: "desc",
    attachedNodeId: "n-dairy",
    isSponsored: true,
    isActive: true,
    frequencyCapPerSession: 3,
    ...overrides,
  };
}

describe("selectRoutePromotions", () => {
  it("returns nothing when promotions are disabled for the store", () => {
    const route = baseRoute();
    const promos = [basePromo()];
    expect(selectRoutePromotions(route, promos, false)).toEqual([]);
  });

  it("excludes inactive promotions", () => {
    const route = baseRoute();
    const promos = [basePromo({ isActive: false })];
    expect(selectRoutePromotions(route, promos, true)).toEqual([]);
  });

  it("excludes promotions not on the walked path", () => {
    const route = baseRoute();
    const promos = [basePromo({ attachedNodeId: "n-frozen" })];
    expect(selectRoutePromotions(route, promos, true)).toEqual([]);
  });

  it("excludes promotions scoped to a different store", () => {
    const route = baseRoute();
    const promos = [basePromo({ storeId: "other-store" })];
    expect(selectRoutePromotions(route, promos, true)).toEqual([]);
  });

  it("includes chain-wide promotions with no storeId", () => {
    const route = baseRoute();
    const promos = [basePromo({ storeId: undefined })];
    expect(selectRoutePromotions(route, promos, true)).toHaveLength(1);
  });

  it("excludes promotions outside their date range", () => {
    const now = new Date("2026-06-15T00:00:00.000Z");
    const route = baseRoute();
    const expired = basePromo({ id: "expired", endDate: "2026-01-01T00:00:00.000Z" });
    const notYetStarted = basePromo({ id: "future", startDate: "2026-12-01T00:00:00.000Z" });
    const current = basePromo({
      id: "current",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T00:00:00.000Z",
    });
    const result = selectRoutePromotions(route, [expired, notYetStarted, current], true, { now });
    expect(result.map((p) => p.id)).toEqual(["current"]);
  });

  it("caps the number of promotions shown per route", () => {
    const route = baseRoute();
    const promos = [
      basePromo({ id: "a", attachedNodeId: "n-dairy" }),
      basePromo({ id: "b", attachedNodeId: "n-beverages" }),
      basePromo({ id: "c", attachedNodeId: "n-dairy" }),
    ];
    const result = selectRoutePromotions(route, promos, true);
    expect(result).toHaveLength(2);
  });

  it("excludes a promotion once the session has hit its frequency cap", () => {
    const route = baseRoute();
    const promo = basePromo({ id: "capped", frequencyCapPerSession: 2 });
    const priorEvents = [
      {
        id: "ev-1",
        type: "promotion_impression" as const,
        sessionId: "session-1",
        payload: { promotionId: "capped" },
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "ev-2",
        type: "promotion_impression" as const,
        sessionId: "session-1",
        payload: { promotionId: "capped" },
        timestamp: "2026-01-01T00:01:00.000Z",
      },
    ];

    const result = selectRoutePromotions(route, [promo], true, {
      session: { sessionId: "session-1", priorEvents },
    });
    expect(result).toEqual([]);
  });

  it("still shows a promotion to a different session under the same cap", () => {
    const route = baseRoute();
    const promo = basePromo({ id: "capped", frequencyCapPerSession: 2 });
    const priorEvents = [
      {
        id: "ev-1",
        type: "promotion_impression" as const,
        sessionId: "session-1",
        payload: { promotionId: "capped" },
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "ev-2",
        type: "promotion_impression" as const,
        sessionId: "session-1",
        payload: { promotionId: "capped" },
        timestamp: "2026-01-01T00:01:00.000Z",
      },
    ];

    const result = selectRoutePromotions(route, [promo], true, {
      session: { sessionId: "session-2", priorEvents },
    });
    expect(result).toHaveLength(1);
  });
});
