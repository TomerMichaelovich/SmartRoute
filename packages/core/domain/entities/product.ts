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
  /**
   * Set on products imported from a price file: the barcode (retail_items.item_key)
   * the product stands for - one product per barcode, whichever chain sells it
   * (chainId is set only on a chain's own label). Unset = made by hand.
   */
  sourceItemKey?: string | null;
  /** Where an imported product stands - a ShelfGroup id (see value-objects/shelf-group). */
  shelfGroup?: string | null;
  /** An admin edited this imported product; re-imports keep its name, aliases and group. */
  manuallyEdited?: boolean;
}
