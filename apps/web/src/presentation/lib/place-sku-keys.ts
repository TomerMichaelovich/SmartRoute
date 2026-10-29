import "server-only";
import { isGenericProduct } from "@smartroute/core/application/classification/resolve-before-branch";
import { type GenericSkuKeys, placeCandidates } from "@smartroute/core/application/routing/place-choice";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { priceRepository } from "@/src/infrastructure/container";

/**
 * The linked barcodes of every product an item could stand for at this store,
 * for placeQuestions/placeDecisions to follow a cheapest-basket pick. Only
 * items with something to choose and a barcode picked cost a lookup.
 */
export async function placeSkuKeys(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  genericSkuKeys?: GenericSkuKeys,
): Promise<Map<string, Set<string>>> {
  const productIds = new Set<string>();
  for (const item of items) {
    if (item.variant?.kind !== "sku") continue;
    const candidates = placeCandidates(item, storeId, listings, products, genericSkuKeys);
    if (candidates.length > 1) candidates.forEach((id) => productIds.add(id));
  }
  if (productIds.size === 0) return new Map();
  const options = await priceRepository.findSkuOptions([...productIds]);
  return new Map([...options].map(([productId, skus]) => [productId, new Set(skus.map((s) => s.itemKey))]));
}

/**
 * The barcodes linked to each generic product the items are classified as, so routing
 * at a store with imported products also finds those the line doesn't name ("גבינה
 * צהובה" -> the store's "גבינה עמק 28%"). No lookup when the store has none placed.
 */
export async function genericSkuKeysFor(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
): Promise<GenericSkuKeys> {
  const placed = new Set(listings.filter((l) => l.storeId === storeId).map((l) => l.productId));
  if (!products.some((p) => p.sourceItemKey && placed.has(p.id))) return new Map();
  const productById = new Map(products.map((p) => [p.id, p]));
  const generic = new Set<string>();
  for (const item of items) {
    const product = productById.get(item.classification?.matchedProductId ?? "");
    if (product && isGenericProduct(product)) generic.add(product.id);
  }
  if (generic.size === 0) return new Map();
  const options = await priceRepository.findSkuOptions([...generic]);
  return new Map([...options].map(([productId, skus]) => [productId, new Set(skus.map((s) => s.itemKey))]));
}
