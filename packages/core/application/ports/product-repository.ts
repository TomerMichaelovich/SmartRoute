import type { Product } from "@smartroute/core/domain/entities/product";

export interface IProductRepository {
  findAllActive(): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: string, patch: Partial<Product>): Promise<Product>;
}
