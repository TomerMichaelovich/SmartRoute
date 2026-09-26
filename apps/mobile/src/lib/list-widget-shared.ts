import type { ProductCategory } from "@smartroute/core/domain/entities/product";

// Shown collapsed before the "show more" toggle - shared so the in-app
// HomeListWidget card and the native Android home-screen widget (MyListWidget)
// stay in visual sync.
export const COLLAPSED_ITEM_COUNT = 4;

// Placeholder emoji per product category - swap for the web admin's PRODUCT_ICONS
// image set (packages/core/map/product-icons.ts) once those are bundled for mobile.
export const CATEGORY_ICON: Record<ProductCategory, string> = {
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
