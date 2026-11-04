import { and, eq, inArray } from "drizzle-orm";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import { db } from "../../db/client";
import { productListings } from "../../db/schema";
import type { IProductListingRepository } from "../interfaces/product-listing-repository";
import { productListingSchema } from "../schemas";

// Shelf groups can hold hundreds of products: write them in a few statements, not one each.
const WRITE_BATCH = 500;

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

  async createMany(listings: ProductListing[]): Promise<void> {
    for (let i = 0; i < listings.length; i += WRITE_BATCH) {
      await db.insert(productListings).values(listings.slice(i, i + WRITE_BATCH));
    }
  }

  async moveToNode(storeId: string, productIds: string[], nodeId: string): Promise<void> {
    for (let i = 0; i < productIds.length; i += WRITE_BATCH) {
      await db
        .update(productListings)
        .set({ nodeId })
        .where(and(eq(productListings.storeId, storeId), inArray(productListings.productId, productIds.slice(i, i + WRITE_BATCH))));
    }
  }

  async deleteAtNode(storeId: string, nodeId: string, productIds: string[]): Promise<void> {
    for (let i = 0; i < productIds.length; i += WRITE_BATCH) {
      await db
        .delete(productListings)
        .where(
          and(
            eq(productListings.storeId, storeId),
            eq(productListings.nodeId, nodeId),
            inArray(productListings.productId, productIds.slice(i, i + WRITE_BATCH)),
          ),
        );
    }
  }

  async deleteInStore(storeId: string, productIds: string[]): Promise<void> {
    for (let i = 0; i < productIds.length; i += WRITE_BATCH) {
      await db
        .delete(productListings)
        .where(and(eq(productListings.storeId, storeId), inArray(productListings.productId, productIds.slice(i, i + WRITE_BATCH))));
    }
  }

  async delete(id: string): Promise<void> {
    await db.delete(productListings).where(eq(productListings.id, id));
  }
}
