import type { ProductCategory } from "@/src/domain/entities/product";

/** Hebrew display labels for ProductCategory - stored/submitted values stay the English enum. */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
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
