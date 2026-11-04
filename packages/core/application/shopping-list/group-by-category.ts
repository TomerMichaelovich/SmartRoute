import type { ProductCategory } from "../../domain/entities/product";
import type { ShoppingListItem } from "../../domain/entities/shopping-list";

/** Departments in the order a typical supermarket walk meets them. */
export const CATEGORY_ORDER: ProductCategory[] = [
  "produce",
  "bakery",
  "dairy",
  "meat_fish",
  "frozen",
  "pantry",
  "beverages",
  "snacks",
  "household",
  "personal_care",
  "other",
];

/** Hebrew department names - shared by the admin UI and the WhatsApp bot. */
export const CATEGORY_LABEL_HE: Record<ProductCategory, string> = {
  produce: "ירקות ופירות",
  bakery: "מאפייה",
  dairy: "מוצרי חלב",
  meat_fish: "בשר ודגים",
  frozen: "קפואים",
  pantry: "מזווה",
  beverages: "משקאות",
  snacks: "חטיפים",
  household: "בית",
  personal_care: "טיפוח אישי",
  other: "אחר",
};

export const CATEGORY_EMOJI: Record<ProductCategory, string> = {
  produce: "🥦",
  bakery: "🍞",
  dairy: "🥛",
  meat_fish: "🥩",
  frozen: "🧊",
  pantry: "🥫",
  beverages: "🥤",
  snacks: "🍿",
  household: "🧽",
  personal_care: "🧴",
  other: "🛒",
};

export interface CategorySection {
  category: ProductCategory;
  items: ShoppingListItem[];
}

/**
 * Groups items by department, departments in CATEGORY_ORDER, items keeping
 * their order within one. Items with no known department go under "other".
 */
export function groupByCategory(
  items: ShoppingListItem[],
  categoryOf: (item: ShoppingListItem) => ProductCategory | undefined,
): CategorySection[] {
  const byCategory = new Map<ProductCategory, ShoppingListItem[]>();
  for (const item of items) {
    const category = categoryOf(item) ?? "other";
    const bucket = byCategory.get(category) ?? [];
    bucket.push(item);
    byCategory.set(category, bucket);
  }
  return CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => ({
    category,
    items: byCategory.get(category)!,
  }));
}
