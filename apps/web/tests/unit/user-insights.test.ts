import { describe, expect, it } from "vitest";
import {
  getNotFoundItems,
  getShoppingTimeProfile,
  getStoreBreakdown,
  getTopProducts,
  getTripStats,
  getUnmatchedItems,
  getUserLifecycleStatus,
  toEpochMs,
} from "@smartroute/core/application/analytics/user-insights";
import type { ShoppingTrip, ShoppingTripItem } from "@smartroute/core/domain/entities/shopping-trip";

function item(overrides: Partial<ShoppingTripItem> & { rawText: string }): ShoppingTripItem {
  return { productName: overrides.rawText, collected: true, notFound: false, ...overrides };
}

function trip(id: string, startedAt: string, completedAt: string, items: ShoppingTripItem[], store = "s1"): ShoppingTrip {
  return {
    id,
    userId: "u1",
    householdId: null,
    storeId: store,
    storeName: store === "s1" ? "סניף א" : "סניף ב",
    routeId: `r-${id}`,
    shoppingListId: null,
    startedAt,
    completedAt,
    items,
    createdAt: completedAt,
  };
}

const trips: ShoppingTrip[] = [
  trip("t1", "2026-09-01T08:00:00.000Z", "2026-09-01T08:20:00.000Z", [
    item({ rawText: "חלב" }),
    item({ rawText: "לחם", collected: false, notFound: true }),
    item({ rawText: "משהו", productName: null, collected: false }),
  ]),
  trip("t2", "2026-09-05T15:00:00.000Z", "2026-09-05T15:10:00.000Z", [
    item({ rawText: "חלב" }),
    item({ rawText: "ביצים" }),
  ]),
  trip(
    "t3",
    "2026-09-11T18:00:00.000Z",
    "2026-09-11T18:30:00.000Z",
    [item({ rawText: "חלב" }), item({ rawText: "חלב" })],
    "s2",
  ),
];

describe("toEpochMs", () => {
  it("reads zone-less DB timestamps as UTC", () => {
    expect(toEpochMs("2026-09-30 12:00:00.5")).toBe(Date.parse("2026-09-30T12:00:00.500Z"));
  });

  it("keeps explicit zones", () => {
    expect(toEpochMs("2026-09-30T12:00:00+03:00")).toBe(Date.parse("2026-09-30T09:00:00Z"));
  });
});

describe("getTripStats", () => {
  it("summarizes duration, items, not-found rate and frequency", () => {
    const stats = getTripStats(trips);
    expect(stats.tripCount).toBe(3);
    expect(stats.firstTripAt).toBe("2026-09-01T08:20:00.000Z");
    expect(stats.lastTripAt).toBe("2026-09-11T18:30:00.000Z");
    expect(stats.avgDurationSeconds).toBe(20 * 60);
    expect(stats.avgItemsPerTrip).toBeCloseTo(7 / 3);
    expect(stats.notFoundRate).toBeCloseTo(1 / 7);
    expect(stats.avgDaysBetweenTrips).toBeCloseTo((10 + 10 / 24 + 10 / 60 / 24) / 2, 3);
  });

  it("ignores implausibly long trips for the duration average", () => {
    const stale = trip("x", "2026-09-01T08:00:00.000Z", "2026-09-02T08:00:00.000Z", []);
    expect(getTripStats([stale]).avgDurationSeconds).toBeNull();
  });

  it("handles no trips", () => {
    expect(getTripStats([])).toMatchObject({ tripCount: 0, avgDaysBetweenTrips: null, notFoundRate: 0 });
  });
});

describe("item rankings", () => {
  it("ranks collected products by how many trips they appear in", () => {
    expect(getTopProducts(trips)).toEqual([
      { name: "חלב", count: 4, tripCount: 3 },
      { name: "ביצים", count: 1, tripCount: 1 },
    ]);
  });

  it("lists not-found and unmatched items separately", () => {
    expect(getNotFoundItems(trips).map((i) => i.name)).toEqual(["לחם"]);
    expect(getUnmatchedItems(trips).map((i) => i.name)).toEqual(["משהו"]);
  });
});

describe("getStoreBreakdown", () => {
  it("counts trips per store, most visited first", () => {
    expect(getStoreBreakdown(trips)).toEqual([
      { storeId: "s1", storeName: "סניף א", tripCount: 2 },
      { storeId: "s2", storeName: "סניף ב", tripCount: 1 },
    ]);
  });
});

describe("getShoppingTimeProfile", () => {
  it("buckets trip starts by weekday and part of day in the given zone", () => {
    const profile = getShoppingTimeProfile(trips, "Asia/Jerusalem");
    // 2026-09-01 is a Tuesday (11:00 IDT), 09-05 Saturday (18:00), 09-11 Friday (21:00).
    expect(profile.byWeekday).toEqual([0, 0, 1, 0, 0, 1, 1]);
    expect(profile.byDayPart).toEqual({ morning: 1, noon: 0, evening: 2, night: 0 });
  });
});

describe("getUserLifecycleStatus", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("separates fresh sign-ups from ones that never shopped", () => {
    expect(getUserLifecycleStatus({ createdAt: "2026-09-27T00:00:00Z", lastActiveAt: null, tripCount: 0 }, now)).toBe("new");
    expect(getUserLifecycleStatus({ createdAt: "2026-09-01T00:00:00Z", lastActiveAt: null, tripCount: 0 }, now)).toBe(
      "not_activated",
    );
  });

  it("grades shoppers by how long they've been idle", () => {
    const base = { createdAt: "2026-01-01T00:00:00Z", tripCount: 2 };
    expect(getUserLifecycleStatus({ ...base, lastActiveAt: "2026-09-25T00:00:00Z" }, now)).toBe("active");
    expect(getUserLifecycleStatus({ ...base, lastActiveAt: "2026-09-01T00:00:00Z" }, now)).toBe("at_risk");
    expect(getUserLifecycleStatus({ ...base, lastActiveAt: "2026-07-01T00:00:00Z" }, now)).toBe("dormant");
  });
});
