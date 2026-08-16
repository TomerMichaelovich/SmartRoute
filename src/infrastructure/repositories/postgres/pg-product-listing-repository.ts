import { eq } from "drizzle-orm";
import type { ProductListing } from "@/src/domain/entities/product-listing";
import { db } from "../../db/client";
import { productListings } from "../../db/schema";
import type { IProductListingRepository } from "../interfaces/product-listing-repository";
import { productListingSchema } from "../schemas";

export class PgProductListingRepository implements IProductListingRepository {
  async findByStore(storeId: string): Promise<ProductListing[]> {
    const rows = await db
      .select()
      .from(productListings)
      .where(eq(productListings.storeId, storeId));
    return rows.map((row) => productListingSchema.parse(row));
  }

  async findByProduct(productId: string): Promise<ProductListing[]> {
    const rows = await db
      .select()
      .from(productListings)
      .where(eq(productListings.productId, productId));
    return rows.map((row) => productListingSchema.parse(row));
  }

  async create(listing: ProductListing): Promise<ProductListing> {
    await db.insert(productListings).values(listing);
    return listing;
  }

  async delete(id: string): Promise<void> {
    await db.delete(productListings).where(eq(productListings.id, id));
  }
}
