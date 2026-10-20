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

export interface Product {
  id: string;
  canonicalName: string;
  aliases: string[];
  /** Precomputed normalizeHebrewText() of canonicalName + every alias, for fast lookup. */
  normalizedAliases: string[];
  category: ProductCategory;
  department: string;
  imageUrl?: string;
  isActive: boolean;
  /**
   * The chain this product is exclusive to (a Store.chainId - e.g. a private
   * label sold only there). Unset = a generic product any chain may carry.
   * Before a branch is picked, only generic products are offered.
   */
  chainId?: string | null;
}
