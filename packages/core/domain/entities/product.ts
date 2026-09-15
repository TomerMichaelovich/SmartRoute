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
}
