import type { Product } from "@/src/domain/entities/product";

export interface IProductRepository {
  findAllActive(): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: string, patch: Partial<Product>): Promise<Product>;
}
