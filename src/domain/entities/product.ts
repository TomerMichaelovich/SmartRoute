export type ProductCategory =
  | "produce"
  | "bakery"
  | "dairy"
  | "meat_fish"
  | "frozen"
  | "pantry"
  | "beverages"
  | "snacks"
  | "household"
  | "personal_care"
  | "other";

export interface ProductStoreLocation {
  storeId: string;
  nodeId: string;
  shelf?: string;
  zone?: string;
}

export interface Product {
  id: string;
  chainId: string;
  canonicalName: string;
  aliases: string[];
  /** Precomputed normalizeHebrewText() of canonicalName + every alias, for fast lookup. */
  normalizedAliases: string[];
  category: ProductCategory;
  department: string;
  locations: ProductStoreLocation[];
  isActive: boolean;
}
