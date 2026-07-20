import type { Product } from "@/src/domain/entities/product";
import type { IProductRepository } from "../interfaces/product-repository";
import { JsonFileStore } from "./json-file-store";
import { productSchema } from "./schemas";

export class JsonProductRepository implements IProductRepository {
  private readonly store = new JsonFileStore<Product>("products.json", productSchema);

  async findAllActive(): Promise<Product[]> {
    const all = await this.store.readAll();
    return all.filter((p) => p.isActive);
  }

  async findAll(): Promise<Product[]> {
    return this.store.readAll();
  }

  async findById(id: string): Promise<Product | null> {
    const all = await this.store.readAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async create(product: Product): Promise<Product> {
    await this.store.mutate((items) => [...items, product]);
    return product;
  }

  async update(id: string, patch: Partial<Product>): Promise<Product> {
    let updated: Product | undefined;
    await this.store.mutate((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      }),
    );
    if (!updated) throw new Error(`Product not found: ${id}`);
    return updated;
  }
}
