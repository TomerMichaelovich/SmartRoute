import type { ProductListing } from "@/src/domain/entities/product-listing";

export interface IProductListingRepository {
  findByStore(storeId: string): Promise<ProductListing[]>;
  findByProduct(productId: string): Promise<ProductListing[]>;
  create(listing: ProductListing): Promise<ProductListing>;
  delete(id: string): Promise<void>;
}
