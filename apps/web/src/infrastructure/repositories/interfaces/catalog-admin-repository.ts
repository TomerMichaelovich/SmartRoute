import type { Product } from "@smartroute/core/domain/entities/product";

/** One shelf group as a mapped store sees it. */
export interface StoreShelfGroup {
  groupId: string;
  /** Active products of the group in the store's linked price branch file, less those marked as not sold here. */
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
  /** As written, the way shoppers find it. */
  aliases: string[];
  normalizedAliases: string[];
  /** Imported from a price file. */
  imported: boolean;
  /** In the price file of the store's linked branch. */
  carried: boolean;
  /** Marked as not sold at this store. */
  excluded: boolean;
}

/** An imported product the store's branch carries, found by one of its aliases. */
export interface AliasProduct {
  id: string;
  canonicalName: string;
  aliases: string[];
  /** The barcode it was imported for. */
  sourceItemKey: string | null;
  /** Where it's placed in the store; null when it isn't yet. */
  nodeId: string | null;
}

export interface AdminProductQuery {
  /** Hebrew-normalized text matched against name and aliases. */
  text?: string;
  /**
   * Digits matched (leading zeros aside) against the product's own barcode or a chain SKU
   * linked to it. Given with `text`, a product matching either one is found.
   */
  barcode?: string;
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
  /**
   * The products of the store's branch file answering exactly to one of these normalized
   * texts (an alias or the name) - less those marked as not sold here - and where each is placed.
   */
  aliasProducts(storeId: string, normalizedAliases: string[]): Promise<AliasProduct[]>;
  /** Aliases of the store's branch products containing the text (those starting with it first), with how many products have each. */
  aliasSuggestions(storeId: string, text: string, limit: number): Promise<Array<{ alias: string; products: number }>>;
  /** Where the store's placed products answering to these aliases (as written) stand, per alias and node. */
  aliasPlacements(storeId: string, aliases: string[]): Promise<Array<{ alias: string; nodeId: string; count: number }>>;
  /** Aliases whose placed products stand at more than one node of the store, with how many at each. */
  splitAliases(storeId: string): Promise<Array<{ alias: string; nodes: Array<{ nodeId: string; count: number }> }>>;
  /** The group's products placed at this node, with the aliases shoppers find them by. */
  groupProductsAtNode(
    storeId: string,
    nodeId: string,
    groupId: string,
  ): Promise<Array<{ id: string; canonicalName: string; aliases: string[]; sourceItemKey: string | null }>>;
  /** Hand-made (not imported) products placed in the store - few enough to load whole. */
  listedHandMadeProducts(storeId: string): Promise<Product[]>;
  /** Active products matching the text that aren't placed in the store yet, best candidates first. */
  searchUnlisted(storeId: string, normalizedText: string, limit: number): Promise<ProductSearchHit[]>;
  searchProducts(query: AdminProductQuery): Promise<{ products: Product[]; total: number }>;
  /** Products marked as not sold at the store, by name. */
  excludedProducts(storeId: string): Promise<Array<{ id: string; canonicalName: string; shelfGroup: string | null }>>;
  /** Marks products as not sold at the store (true) or clears the mark (false). */
  setExcluded(storeId: string, productIds: string[], excluded: boolean): Promise<void>;
  departments(imported: boolean): Promise<string[]>;
}
