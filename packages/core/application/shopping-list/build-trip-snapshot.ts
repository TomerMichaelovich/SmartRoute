import type { ShoppingListItem } from "../../domain/entities/shopping-list";
import type { ShoppingTripItem } from "../../domain/entities/shopping-trip";

/**
 * Freezes a shopping list into the item snapshot stored on a completed
 * ShoppingTrip. Pure so it's shared by the web recorder and (later) the
 * native app, and easy to test.
 */
export function buildTripItems(
  items: ShoppingListItem[],
  productNameById: Map<string, string>,
  collectedItemIds: ReadonlySet<string>,
  notFoundItemIds: ReadonlySet<string>,
): ShoppingTripItem[] {
  return items.map((item) => {
    const productId = item.classification?.matchedProductId;
    return {
      rawText: item.rawText,
      quantity: item.quantity,
      productName: productId ? (productNameById.get(productId) ?? null) : null,
      collected: collectedItemIds.has(item.id),
      notFound: notFoundItemIds.has(item.id),
    };
  });
}
