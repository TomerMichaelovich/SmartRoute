import type { Product } from "@smartroute/core/domain/entities/product";

/** One shelf group as a mapped store sees it. */
export interface StoreShelfGroup {
  groupId: string;
  /** Active products of the group in the store's linked price branch file. */
  carried: number;
  /** Of those, not yet placed anywhere in the store. */
  unplaced: number;
  /** Where the group's products are placed in the store (any product of the group, carried or not). */
  nodes: Array<{ nodeId: string; count: number }>;
}

export interface ProductSearchHit {
  id: string;
  canonicalName: string;
  department: string;
  shelfGroup: string | null;
  normalizedAliases: string[];
  /** Imported from a price file. */
  imported: boolean;
  /** In the price file of the store's linked branch. */
  carried: boolean;
}

export interface AdminProductQuery {
  /** Hebrew-normalized text matched against name and aliases. */
  text?: string;
  department?: string;
  shelfGroup?: string;
  /** true: only products imported from price files; false: only hand-made ones. */
  imported: boolean;
  offset: number;
  limit: number;
}

/**
 * The admin side of the imported catalog: placing whole shelf groups on a store's
 * map and finding one product among thousands, without loading them all.
 */
export interface ICatalogAdminRepository {
  /** Whether the store is linked to a price branch (shelf groups only make sense then). */
  hasPriceBranch(storeId: string): Promise<boolean>;
  shelfGroupsForStore(storeId: string): Promise<StoreShelfGroup[]>;
  /** The group's active products in the store's branch file that aren't placed in the store yet. */
  unplacedGroupProductIds(storeId: string, groupId: string): Promise<string[]>;
  /** The group's products placed at this node. */
  groupProductsAtNode(storeId: string, nodeId: string, groupId: string): Promise<Array<{ id: string; canonicalName: string }>>;
  /** Hand-made (not imported) products placed in the store - few enough to load whole. */
  listedHandMadeProducts(storeId: string): Promise<Product[]>;
  /** Active products matching the text that aren't placed in the store yet, best candidates first. */
  searchUnlisted(storeId: string, normalizedText: string, limit: number): Promise<ProductSearchHit[]>;
  searchProducts(query: AdminProductQuery): Promise<{ products: Product[]; total: number }>;
  departments(imported: boolean): Promise<string[]>;
}
