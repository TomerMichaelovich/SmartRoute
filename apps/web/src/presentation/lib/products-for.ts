import "server-only";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { productRepository } from "@/src/infrastructure/container";

/**
 * The products a request about a list needs, without the thousands imported from
 * price files: the hand-made catalog, everything placed at `storeId` when routing
 * there, and whatever the items already point to (a product picked by hand, or in
 * a store) so their names and icons still show.
 */
export async function productsFor({ items = [], storeId }: { items?: ShoppingListItem[]; storeId?: string }): Promise<Product[]> {
  const base = storeId ? await productRepository.findForStore(storeId) : await productRepository.findCatalog();
  const have = new Set(base.map((p) => p.id));
  const referenced = new Set<string>();
  for (const item of items) {
    for (const id of [item.classification?.matchedProductId, item.placeChoice?.productId, item.variant?.productId]) {
      if (id && !have.has(id)) referenced.add(id);
    }
  }
  return referenced.size > 0 ? [...base, ...(await productRepository.findByIds([...referenced]))] : base;
}
