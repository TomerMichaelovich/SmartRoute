import type { ProductListing } from "@/src/domain/entities/product-listing";
import type { IProductListingRepository } from "../interfaces/product-listing-repository";
import { JsonFileStore } from "./json-file-store";
import { productListingSchema } from "./schemas";

export class JsonProductListingRepository implements IProductListingRepository {
  private readonly store = new JsonFileStore<ProductListing>(
    "product-listings.json",
    productListingSchema,
  );

  async findByStore(storeId: string): Promise<ProductListing[]> {
    const all = await this.store.readAll();
    return all.filter((l) => l.storeId === storeId);
  }

  async findByProduct(productId: string): Promise<ProductListing[]> {
    const all = await this.store.readAll();
    return all.filter((l) => l.productId === productId);
  }

  async create(listing: ProductListing): Promise<ProductListing> {
    await this.store.mutate((items) => [...items, listing]);
    return listing;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((items) => items.filter((item) => item.id !== id));
  }
}
