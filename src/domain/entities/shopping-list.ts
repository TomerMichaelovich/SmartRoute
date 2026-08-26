import type { ClassificationResult } from "./classification-result";

export interface ShoppingListItem {
  id: string;
  rawText: string;
  quantity?: number;
  classification?: ClassificationResult;
}

export interface ShoppingList {
  id: string;
  storeId: string;
  items: ShoppingListItem[];
  // null only for rows created before the share-code feature existed; every
  // list created going forward always has one.
  shareCode: string | null;
  createdAt: string;
  updatedAt: string;
}
