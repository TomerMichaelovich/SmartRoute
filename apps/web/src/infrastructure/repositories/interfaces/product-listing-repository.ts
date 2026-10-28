import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";

export interface IProductListingRepository {
  findByStore(storeId: string): Promise<ProductListing[]>;
  findByProduct(productId: string): Promise<ProductListing[]>;
  create(listing: ProductListing): Promise<ProductListing>;
  /** Places many products at once (a shelf group); products already listed in the store are skipped by the caller. */
  createMany(listings: ProductListing[]): Promise<void>;
  /** Moves the store's listings of these products to another node. */
  moveToNode(storeId: string, productIds: string[], nodeId: string): Promise<void>;
  /** Removes these products' listings at one node. */
  deleteAtNode(storeId: string, nodeId: string, productIds: string[]): Promise<void>;
  /** Removes these products' listings anywhere in the store. */
  deleteInStore(storeId: string, productIds: string[]): Promise<void>;
  delete(id: string): Promise<void>;
}
