import type { ShoppingListItem, ShoppingListItemVariant } from "../../domain/entities/shopping-list";

/**
 * The item's saved refinement choice, if it still applies. A choice is tied to the
 * generic product it was made for: once the item is edited or reclassified to
 * another product ("חלב" -> "חלב סויה"), the old choice is silently ignored —
 * no write needed, and older app versions that don't know about variants can't
 * leave a stale one behind.
 */
export function effectiveVariant(item: ShoppingListItem): ShoppingListItemVariant | null {
  const variant = item.variant;
  if (!variant) return null;
  const productId = item.classification?.matchedProductId;
  if ((variant.productId ?? null) !== (productId ?? null)) return null;
  if (variant.kind === "sku" && !variant.itemKey) return null;
  return variant;
}
