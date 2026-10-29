import type { Product } from "@smartroute/core/domain/entities/product";

export interface IProductRepository {
  findAllActive(): Promise<Product[]>;
  /**
   * Active products made by hand - the generic catalog and chains' own - without the
   * thousands imported from price files (Product.sourceItemKey). What a list line is
   * classified against and what the app suggests before a branch is picked.
   */
  findCatalog(): Promise<Product[]>;
  /** The catalog plus every active product placed at this store - what routing there can choose from. */
  findForStore(storeId: string): Promise<Product[]>;
  /** Active products by id (those a list's items point to). */
  findByIds(ids: string[]): Promise<Product[]>;
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: Product): Promise<Product>;
  update(id: string, patch: Partial<Product>): Promise<Product>;
}
