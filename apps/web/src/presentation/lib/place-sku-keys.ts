import "server-only";
import { placeCandidates } from "@smartroute/core/application/routing/place-choice";
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
): Promise<Map<string, Set<string>>> {
  const productIds = new Set<string>();
  for (const item of items) {
    if (item.variant?.kind !== "sku") continue;
    const candidates = placeCandidates(item, storeId, listings, products);
    if (candidates.length > 1) candidates.forEach((id) => productIds.add(id));
  }
  if (productIds.size === 0) return new Map();
  const options = await priceRepository.findSkuOptions([...productIds]);
  return new Map([...options].map(([productId, skus]) => [productId, new Set(skus.map((s) => s.itemKey))]));
}
