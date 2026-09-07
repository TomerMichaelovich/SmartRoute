import type { ClassificationResult } from "./classification-result";

export interface ShoppingListItem {
  id: string;
  rawText: string;
  quantity?: number;
  classification?: ClassificationResult;
  // Shared-list collaboration state. On a personal/guest list these stay
  // undefined and "collected" tracking lives client-side (localStorage) as
  // before; on a household list they're the shared source of truth.
  checked?: boolean;
  checkedByUserId?: string;
  checkedByName?: string;
  checkedAt?: string;
  notFound?: boolean;
  addedByUserId?: string;
}

export interface ShoppingList {
  id: string;
  storeId: string;
  items: ShoppingListItem[];
  // null only for rows created before the share-code feature existed; every
  // list created going forward always has one.
  shareCode: string | null;
  // Ownership. All null => anonymous guest list. `ownerUserId` set => a
  // registered user's personal list. `householdId` set => a shared list.
  ownerUserId: string | null;
  householdId: string | null;
  // User-facing name; null => the UI shows a generated default.
  name: string | null;
  // The single list surfaced as "active" for its owner.
  isActive: boolean;
  // Soft-delete marker; deleted lists are hidden but never hard-removed.
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
