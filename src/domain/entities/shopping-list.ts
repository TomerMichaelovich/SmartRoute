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
  createdAt: string;
}
