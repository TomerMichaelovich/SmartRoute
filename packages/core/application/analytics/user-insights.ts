import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";

/**
 * Per-user aggregates for the admin "users" view, computed on demand over one
 * user's already-read trip history (same approach as analytics-service - no
 * precomputed tables at pilot volumes).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
// Anything longer is almost certainly a route left open, not a real visit.
const MAX_PLAUSIBLE_TRIP_MS = 4 * 60 * 60 * 1000;

/**
 * Epoch ms for a DB timestamp. Columns are `timestamp without time zone`
 * holding UTC, so a zone-less value ("2026-09-30 12:00:00.123") must be read
 * as UTC - `new Date()` would otherwise take it as the server's local time.
 */
export function toEpochMs(timestamp: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp);
  return Date.parse(hasZone ? timestamp : `${timestamp.replace(" ", "T")}Z`);
}

export interface TripStats {
  tripCount: number;
  firstTripAt: string | null;
  lastTripAt: string | null;
  /** Mean over trips with a plausible duration; null when there are none. */
  avgDurationSeconds: number | null;
  avgItemsPerTrip: number;
  /** Share of all list items across all trips that were marked "not found". */
  notFoundRate: number;
  /** Mean gap between consecutive trips; null with fewer than two trips. */
  avgDaysBetweenTrips: number | null;
}

export function getTripStats(trips: ShoppingTrip[]): TripStats {
  if (trips.length === 0) {
    return {
      tripCount: 0,
      firstTripAt: null,
      lastTripAt: null,
      avgDurationSeconds: null,
      avgItemsPerTrip: 0,
      notFoundRate: 0,
      avgDaysBetweenTrips: null,
    };
  }

  const sorted = [...trips].sort((a, b) => toEpochMs(a.completedAt) - toEpochMs(b.completedAt));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const durations = sorted
    .map((t) => toEpochMs(t.completedAt) - toEpochMs(t.startedAt))
    .filter((ms) => ms > 0 && ms <= MAX_PLAUSIBLE_TRIP_MS);

  const totalItems = sorted.reduce((sum, t) => sum + t.items.length, 0);
  const notFound = sorted.reduce((sum, t) => sum + t.items.filter((i) => i.notFound).length, 0);

  return {
    tripCount: sorted.length,
    firstTripAt: first.completedAt,
    lastTripAt: last.completedAt,
    avgDurationSeconds:
      durations.length > 0 ? durations.reduce((s, ms) => s + ms, 0) / durations.length / 1000 : null,
    avgItemsPerTrip: totalItems / sorted.length,
    notFoundRate: totalItems > 0 ? notFound / totalItems : 0,
    avgDaysBetweenTrips:
      sorted.length >= 2
        ? (toEpochMs(last.completedAt) - toEpochMs(first.completedAt)) / DAY_MS / (sorted.length - 1)
        : null,
  };
}

export interface ItemFrequency {
  name: string;
  /** Total occurrences (an item listed twice in one trip counts twice). */
  count: number;
  /** Distinct trips the item appeared in. */
  tripCount: number;
}

type TripItem = ShoppingTrip["items"][number];

function rankItems(
  trips: ShoppingTrip[],
  include: (item: TripItem) => boolean,
  nameOf: (item: TripItem) => string,
  limit: number,
): ItemFrequency[] {
  const byName = new Map<string, { count: number; trips: Set<string> }>();
  for (const trip of trips) {
    for (const item of trip.items) {
      if (!include(item)) continue;
      const name = nameOf(item).trim();
      if (!name) continue;
      const entry = byName.get(name) ?? { count: 0, trips: new Set<string>() };
      entry.count += 1;
      entry.trips.add(trip.id);
      byName.set(name, entry);
    }
  }
  return [...byName.entries()]
    .map(([name, e]) => ({ name, count: e.count, tripCount: e.trips.size }))
    .sort((a, b) => b.tripCount - a.tripCount || b.count - a.count || a.name.localeCompare(b.name, "he"))
    .slice(0, limit);
}

/** What the user actually picked up, by resolved product (raw text when unmatched). */
export function getTopProducts(trips: ShoppingTrip[], limit = 10): ItemFrequency[] {
  return rankItems(trips, (i) => i.collected, (i) => i.productName ?? i.rawText, limit);
}

/** Items the user marked as missing from the shelf. */
export function getNotFoundItems(trips: ShoppingTrip[], limit = 10): ItemFrequency[] {
  return rankItems(trips, (i) => i.notFound, (i) => i.productName ?? i.rawText, limit);
}

/** Free-text the classifier never matched to a product - catalog/alias gaps. */
export function getUnmatchedItems(trips: ShoppingTrip[], limit = 10): ItemFrequency[] {
  return rankItems(trips, (i) => i.productName === null, (i) => i.rawText, limit);
}

export interface StoreVisits {
  storeId: string;
  storeName: string;
  tripCount: number;
}

export function getStoreBreakdown(trips: ShoppingTrip[]): StoreVisits[] {
  const byStore = new Map<string, StoreVisits>();
  for (const trip of trips) {
    const entry = byStore.get(trip.storeId) ?? { storeId: trip.storeId, storeName: trip.storeName, tripCount: 0 };
    entry.tripCount += 1;
    byStore.set(trip.storeId, entry);
  }
  return [...byStore.values()].sort((a, b) => b.tripCount - a.tripCount);
}

export type DayPart = "morning" | "noon" | "evening" | "night";

export interface ShoppingTimeProfile {
  /** Trip counts indexed Sunday (0) .. Saturday (6), in the given time zone. */
  byWeekday: number[];
  byDayPart: Record<DayPart, number>;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function dayPartOf(hour: number): DayPart {
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "noon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

/** When the user shops, by the trip's start time in `timeZone`. */
export function getShoppingTimeProfile(trips: ShoppingTrip[], timeZone: string): ShoppingTimeProfile {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  });
  const profile: ShoppingTimeProfile = {
    byWeekday: [0, 0, 0, 0, 0, 0, 0],
    byDayPart: { morning: 0, noon: 0, evening: 0, night: 0 },
  };
  for (const trip of trips) {
    const parts = format.formatToParts(new Date(toEpochMs(trip.startedAt)));
    const weekday = WEEKDAY_INDEX[parts.find((p) => p.type === "weekday")?.value ?? ""];
    const hour = Number(parts.find((p) => p.type === "hour")?.value);
    if (weekday === undefined || Number.isNaN(hour)) continue;
    profile.byWeekday[weekday] += 1;
    profile.byDayPart[dayPartOf(hour)] += 1;
  }
  return profile;
}

export type UserLifecycleStatus = "new" | "not_activated" | "active" | "at_risk" | "dormant";

/**
 * A coarse segment for spotting who to nudge: signed up but never shopped,
 * shopping regularly, or drifting away.
 */
export function getUserLifecycleStatus(
  user: { createdAt: string; lastActiveAt: string | null; tripCount: number },
  now: Date,
): UserLifecycleStatus {
  const daysSince = (ts: string) => (now.getTime() - toEpochMs(ts)) / DAY_MS;
  if (user.tripCount === 0) {
    return daysSince(user.createdAt) <= 7 ? "new" : "not_activated";
  }
  const idleDays = daysSince(user.lastActiveAt ?? user.createdAt);
  if (idleDays <= 14) return "active";
  if (idleDays <= 45) return "at_risk";
  return "dormant";
}
