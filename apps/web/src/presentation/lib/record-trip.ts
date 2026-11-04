import "server-only";
import { buildTripItems } from "@smartroute/core/application/shopping-list/build-trip-snapshot";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import { he } from "@smartroute/core/i18n/he";
import { productRepository, shoppingTripRepository } from "@/src/infrastructure/container";

/**
 * Saves a list shopped without a route (the app's "use as a list" mode, or the
 * WhatsApp bot's "קנייה הושלמה") to the user's trip history. No branch was picked,
 * so it's labelled as a list-mode trip rather than with the list's default store.
 * `list` must still hold the items as they were during the trip.
 */
export async function recordListTrip(
  list: ShoppingList,
  userId: string,
  collectedItemIds: Iterable<string>,
  notFoundItemIds: Iterable<string>,
): Promise<ShoppingTrip> {
  const products = await productRepository.findAllActive();
  const productNameById = new Map(products.map((p) => [p.id, p.canonicalName]));
  const now = new Date().toISOString();
  const trip: ShoppingTrip = {
    id: crypto.randomUUID(),
    userId,
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
  return trip;
}
