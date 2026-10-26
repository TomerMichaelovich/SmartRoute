import { effectiveVariant } from "../basket/effective-variant";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";
import { effectivePlaceChoice } from "../routing/place-choice";
import type { Product } from "../../domain/entities/product";
import type { ShoppingListItem } from "../../domain/entities/shopping-list";

/**
 * How a list item reads on the list: what the shopper typed ("קפה נמס"), and
 * under it what they chose for it, if anything - the barcode picked in the
 * cheapest-basket popup ("קפה מגורען גולד בארי"), else the product picked in a
 * store ("קפה נמס בריסטה"). Never a different product's name in place of the
 * line they wrote.
 */
export function itemDisplay(item: ShoppingListItem, products: Product[]): { name: string; chosen: string | null } {
  const name = item.rawText;
  const variant = effectiveVariant(item);
  if (variant?.kind === "sku" && variant.name) return { name, chosen: variant.name };
  const placed = effectivePlaceChoice(item)?.productId;
  const placedName = placed ? products.find((p) => p.id === placed)?.canonicalName : undefined;
  if (placedName && normalizeHebrewText(placedName) !== normalizeHebrewText(name)) return { name, chosen: placedName };
  return { name, chosen: null };
}
