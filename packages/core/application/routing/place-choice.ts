import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import type { ShoppingListItem, ShoppingListItemPlaceChoice } from "@smartroute/core/domain/entities/shopping-list";
import { listLineCores } from "../classification/list-line";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";

/**
 * A mapped store can carry several products that answer to one list item - the
 * generic "טחינה גולמית" and the chain's own "טחינה גולמית רמי לוי", on
 * different shelves. Classification picks one globally, which says nothing
 * about which shelf the shopper wants, so the route asks (see placeQuestions)
 * or, for "לא משנה לי", takes the one that keeps the walk shortest.
 */

/**
 * Products carried at this store that the item's text names exactly (or
 * without its count/brand), the classified one first. Fewer than two: nothing to choose.
 */
export function placeCandidates(
  item: ShoppingListItem,
  storeId: string,
  listings: ProductListing[],
  products: Product[],
): string[] {
  const carried = new Set(listings.filter((l) => l.storeId === storeId).map((l) => l.productId));
  const normalized = normalizeHebrewText(item.rawText);
  const texts = new Set([normalized, ...listLineCores(normalized)]);
  const candidates = new Set<string>();
  const matched = item.classification?.matchedProductId;
  if (matched && carried.has(matched)) candidates.add(matched);
  for (const product of products) {
    if (carried.has(product.id) && product.normalizedAliases.some((alias) => texts.has(alias))) candidates.add(product.id);
  }
  return [...candidates];
}

/** The item's saved choice, unless the item was edited since. */
export function effectivePlaceChoice(item: ShoppingListItem): ShoppingListItemPlaceChoice | null {
  const choice = item.placeChoice;
  if (!choice || choice.text !== normalizeHebrewText(item.rawText)) return null;
  return choice;
}

/**
 * The candidate the item's cheapest-basket pick points to: a barcode chosen in
 * that popup ("טחינה גולמית רמי לוי 500 ג") linked to one of the candidates.
 * The generic product is usually linked to it too, so the most specific one
 * (fewest linked barcodes) wins.
 */
function pickedInBasket(item: ShoppingListItem, productIds: string[], skuKeys: Map<string, Set<string>> | undefined): string | null {
  const variant = item.variant;
  if (!skuKeys || variant?.kind !== "sku" || !variant.itemKey) return null;
  if (variant.productId && !productIds.includes(variant.productId)) return null;
  const linked = productIds.filter((id) => skuKeys.get(id)?.has(variant.itemKey!));
  if (linked.length === 0) return null;
  return linked.reduce((best, id) => (skuKeys.get(id)!.size < skuKeys.get(best)!.size ? id : best));
}

export interface PlaceQuestion {
  itemId: string;
  rawText: string;
  productIds: string[];
}

/**
 * Items to ask about before routing at this store: several candidates, and no
 * saved choice that applies here ("לא משנה לי" applies everywhere; a product
 * applies where it's one of the candidates) nor a cheapest-basket pick that
 * settles it. `skuKeys`: each candidate product's linked barcodes.
 */
export function placeQuestions(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  skuKeys?: Map<string, Set<string>>,
): PlaceQuestion[] {
  const questions: PlaceQuestion[] = [];
  for (const item of items) {
    if (item.checked) continue;
    const productIds = placeCandidates(item, storeId, listings, products);
    if (productIds.length < 2) continue;
    const choice = effectivePlaceChoice(item);
    if (choice && (choice.productId === null || productIds.includes(choice.productId))) continue;
    if (pickedInBasket(item, productIds, skuKeys)) continue;
    questions.push({ itemId: item.id, rawText: item.rawText, productIds });
  }
  return questions;
}

/**
 * Items whose product is decided by the route: several candidates here and
 * either "לא משנה לי" or no choice at all (routing never blocks on a question:
 * mid-shop re-plans and the review screen don't ask). A saved product that's
 * carried here, or else the product a cheapest-basket pick points to, is
 * applied directly instead (returned in `chosen`).
 */
export function placeDecisions(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  skuKeys?: Map<string, Set<string>>,
): { chosen: Map<string, string>; flexible: Map<string, string[]> } {
  const chosen = new Map<string, string>();
  const flexible = new Map<string, string[]>();
  for (const item of items) {
    const productIds = placeCandidates(item, storeId, listings, products);
    if (productIds.length < 2) continue;
    const choice = effectivePlaceChoice(item);
    const picked =
      choice?.productId && productIds.includes(choice.productId)
        ? choice.productId
        : choice?.productId === null
          ? null
          : pickedInBasket(item, productIds, skuKeys);
    if (picked) chosen.set(item.id, picked);
    else flexible.set(item.id, productIds);
  }
  return { chosen, flexible };
}
