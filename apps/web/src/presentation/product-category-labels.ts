import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { CATEGORY_LABEL_HE } from "@smartroute/core/application/shopping-list/group-by-category";

/** Hebrew display labels for ProductCategory - stored/submitted values stay the English enum. */
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = CATEGORY_LABEL_HE;
