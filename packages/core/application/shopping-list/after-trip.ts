import type { ShoppingListItem } from "../../domain/entities/shopping-list";

/** What a finished trip left behind: every item it covered, and the ones that weren't bought. */
export interface FinishedTrip {
  tripItemIds: string[];
  leftoverItemIds: string[];
}

/** Items from the finished trip that weren't bought (and nobody has ticked off since). */
export function tripLeftovers(items: ShoppingListItem[], trip: FinishedTrip): ShoppingListItem[] {
  const leftover = new Set(trip.leftoverItemIds);
  return items.filter((item) => leftover.has(item.id) && !item.checked);
}

/**
 * The fresh list after a trip: everything bought is gone, items added after the
 * trip stay, and the leftovers stay only when `carryLeftovers` - unticked, ready
 * for the next trip.
 */
export function listAfterTrip(
  items: ShoppingListItem[],
  trip: FinishedTrip,
  carryLeftovers: boolean,
): ShoppingListItem[] {
  const inTrip = new Set(trip.tripItemIds);
  const carried = new Set(carryLeftovers ? tripLeftovers(items, trip).map((item) => item.id) : []);
  return items
    .filter((item) => !inTrip.has(item.id) || carried.has(item.id))
    .map((item) => {
      if (!carried.has(item.id)) return item;
      const { checked: _checked, checkedAt: _at, checkedByName: _name, checkedByUserId: _by, notFound: _nf, ...rest } = item;
      return rest;
    });
}
