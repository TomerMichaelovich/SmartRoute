import { eq } from "drizzle-orm";
import type { Product } from "@/src/domain/entities/product";
import { db } from "../../db/client";
import { products } from "../../db/schema";
import type { IProductRepository } from "../interfaces/product-repository";
import { productSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

function toDomain(row: typeof products.$inferSelect): Product {
  return productSchema.parse({
    ...row,
    imageUrl: row.imageUrl ?? undefined,
  });
}

export class PgProductRepository implements IProductRepository {
  async findAllActive(): Promise<Product[]> {
    const rows = await db.select().from(products).where(eq(products.isActive, true));
    return rows.map(toDomain);
  }

  async findAll(): Promise<Product[]> {
    const rows = await db.select().from(products);
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Product | null> {
    const [row] = await db.select().from(products).where(eq(products.id, id));
    return row ? toDomain(row) : null;
  }

  async create(product: Product): Promise<Product> {
    await db.insert(products).values(product);
    return product;
  }

  async update(id: string, patch: Partial<Product>): Promise<Product> {
    const [row] = await db
      .update(products)
      .set(cleanPatch(patch))
      .where(eq(products.id, id))
      .returning();
    if (!row) throw new Error(`Product not found: ${id}`);
    return toDomain(row);
  }
}
