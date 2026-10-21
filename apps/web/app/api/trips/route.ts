import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTripItems } from "@smartroute/core/application/shopping-list/build-trip-snapshot";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import { he } from "@smartroute/core/i18n/he";
import {
  householdRepository,
  productRepository,
  routeRepository,
  shoppingListRepository,
  shoppingTripRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";
import { notifyListChanged } from "@/src/presentation/lib/list-push";

const itemIdsSchema = {
  collectedItemIds: z.array(z.string()).default([]),
  notFoundItemIds: z.array(z.string()).default([]),
};

// A trip finishes either a route, or a list shopped as a plain checklist ("use as a
// list" - no branch, no route; the app takes the bought items off the list itself).
const requestSchema = z.union([
  z.object({ routeId: z.string().min(1), ...itemIdsSchema }),
  z.object({ listCode: z.string().min(1), ...itemIdsSchema }),
]);

/**
 * Records one immutable shopping trip when the shopper finishes a route, or a
 * list in "use as a list" mode. A no-op (204) for guests and for lists that aren't the
 * caller's - history only exists for a registered owner. Idempotent per route.
 * Finishing also takes the list off its participants' home screens (it stays in the
 * DB - the trip keeps its own snapshot) - unless it's pinned: a standing household list
 * stays, and only what was bought is cleared from it, ready for the next trip.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { collectedItemIds, notFoundItemIds } = parsed.data;
  if ("listCode" in parsed.data) {
    return recordListModeTrip(parsed.data.listCode, collectedItemIds, notFoundItemIds);
  }
  const { routeId } = parsed.data;

  const route = await routeRepository.findById(routeId);
  if (!route) {
    return NextResponse.json({ error: "route_not_found" }, { status: 404 });
  }

  const list = await shoppingListRepository.findById(route.shoppingListId);
  const user = await getCurrentUser();

  if (!list || !user || !(await canKeepHistory(list, user.id))) {
    return new NextResponse(null, { status: 204 });
  }

  const alreadyRecorded = await shoppingTripRepository.existsForRoute(routeId);
  if (list.isPinned) {
    // Once per trip: drop the bought items, keep what wasn't found or wasn't picked up.
    if (!alreadyRecorded) {
      const collected = new Set(collectedItemIds);
      const remaining = list.items.filter((item) => !collected.has(item.id));
      await shoppingListRepository.updateItems(list.id, remaining, new Date().toISOString());
      notifyListChanged(list, user.id);
    }
  } else if (list.isActive) {
    // A shared list is done for everyone once any participant finishes with it.
    await shoppingListRepository.deactivate(list.id);
  }

  if (alreadyRecorded) {
    return new NextResponse(null, { status: 200 });
  }

  const [store, products] = await Promise.all([
    storeRepository.findById(route.storeId),
    productRepository.findAllActive(),
  ]);
  const productNameById = new Map(products.map((p) => [p.id, p.canonicalName]));

  const trip: ShoppingTrip = {
    id: crypto.randomUUID(),
    userId: user.id,
    householdId: list.householdId,
    storeId: route.storeId,
    storeName: store?.name ?? "",
    routeId: route.id,
    shoppingListId: list.id,
    startedAt: route.createdAt,
    completedAt: new Date().toISOString(),
    items: buildTripItems(
      list.items,
      productNameById,
      new Set(collectedItemIds),
      new Set(notFoundItemIds),
    ),
    createdAt: new Date().toISOString(),
  };

  await shoppingTripRepository.create(trip);
  return NextResponse.json({ id: trip.id }, { status: 201 });
}

/**
 * History is written for the completing user when they own the list, or are an
 * active member of the household the list belongs to. Guests and anyone opening
 * someone else's link are silently skipped.
 */
async function canKeepHistory(list: ShoppingList, userId: string): Promise<boolean> {
  if (list.ownerUserId === userId) return true;
  if (!list.householdId) return false;
  const membership = await householdRepository.getMembership(list.householdId, userId);
  return membership?.status === "active";
}

/**
 * A list shopped without a route: no branch was picked, so the trip is labelled as
 * a list-mode one rather than with the list's (default) store. Not idempotent -
 * there's no route to key on - so the app sends it once per finish.
 */
async function recordListModeTrip(listCode: string, collectedItemIds: string[], notFoundItemIds: string[]) {
  const list = await shoppingListRepository.findByShareCode(normalizeShareCode(listCode));
  if (!list) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const user = await getCurrentUser();
  if (!user || !(await canKeepHistory(list, user.id))) {
    return new NextResponse(null, { status: 204 });
  }

  const products = await productRepository.findAllActive();
  const productNameById = new Map(products.map((p) => [p.id, p.canonicalName]));
  const now = new Date().toISOString();
  const trip: ShoppingTrip = {
    id: crypto.randomUUID(),
    userId: user.id,
    householdId: list.householdId,
    storeId: list.storeId,
    storeName: he.history.listModeTrip,
    routeId: null,
    shoppingListId: list.id,
    startedAt: now,
    completedAt: now,
    items: buildTripItems(list.items, productNameById, new Set(collectedItemIds), new Set(notFoundItemIds)),
    createdAt: now,
  };

  await shoppingTripRepository.create(trip);
  return NextResponse.json({ id: trip.id }, { status: 201 });
}

/** The caller's completed trips, newest first - the mobile history screen. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const trips = await shoppingTripRepository.findByUser(user.id);
  return NextResponse.json({ trips });
}
