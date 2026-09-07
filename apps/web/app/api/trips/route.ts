import { NextResponse } from "next/server";
import { z } from "zod";
import { buildTripItems } from "@smartroute/core/application/shopping-list/build-trip-snapshot";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import {
  householdRepository,
  productRepository,
  routeRepository,
  shoppingListRepository,
  shoppingTripRepository,
  storeRepository,
} from "@/src/infrastructure/container";
import { getCurrentUser } from "@/src/presentation/auth/dal";

const requestSchema = z.object({
  routeId: z.string().min(1),
  collectedItemIds: z.array(z.string()).default([]),
  notFoundItemIds: z.array(z.string()).default([]),
});

/**
 * Records one immutable shopping trip when the shopper finishes. Called from
 * the Summary screen. A no-op (204) for guests and for lists that aren't the
 * caller's - history only exists for a registered owner. Idempotent per route.
 */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }
  const { routeId, collectedItemIds, notFoundItemIds } = parsed.data;

  const route = await routeRepository.findById(routeId);
  if (!route) {
    return NextResponse.json({ error: "route_not_found" }, { status: 404 });
  }

  const list = await shoppingListRepository.findById(route.shoppingListId);
  const user = await getCurrentUser();

  // History is written for the completing user when they own the list, or are
  // an active member of the household the list belongs to. Guests and anyone
  // opening someone else's route link are silently skipped.
  let eligible = false;
  if (list && user) {
    if (list.ownerUserId === user.id) {
      eligible = true;
    } else if (list.householdId) {
      const membership = await householdRepository.getMembership(list.householdId, user.id);
      eligible = membership?.status === "active";
    }
  }
  if (!list || !user || !eligible) {
    return new NextResponse(null, { status: 204 });
  }

  if (await shoppingTripRepository.existsForRoute(routeId)) {
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
