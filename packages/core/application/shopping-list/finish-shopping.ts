import type { ShoppingListItem } from "../../domain/entities/shopping-list";

export interface FinishedShopping {
  /** What stays on the list for next time: only the missing items, unticked. */
  remaining: ShoppingListItem[];
  /** Bought - for the trip history. */
  collectedIds: string[];
  /** Missing (wanted but not picked up) - for the trip history. */
  notFoundIds: string[];
}

/**
 * Closing a shopping trip from WhatsApp ("קנייה הושלמה"): everything was bought
 * except `missingIds`, which stay on the list ready for the next trip. An item
 * already ticked as bought (e.g. in the app) counts as bought even if named missing.
 */
export function finishShopping(items: ShoppingListItem[], missingIds: Iterable<string>): FinishedShopping {
  const wanted = new Set(missingIds);
  const missing = items.filter((item) => wanted.has(item.id) && !item.checked);
  const missingSet = new Set(missing.map((item) => item.id));

  return {
    remaining: missing.map((item) => {
      const { checked: _c, checkedAt: _a, checkedByName: _n, checkedByUserId: _u, notFound: _nf, ...rest } = item;
      return rest;
    }),
    collectedIds: items.filter((item) => !missingSet.has(item.id)).map((item) => item.id),
    notFoundIds: [...missingSet],
  };
}
