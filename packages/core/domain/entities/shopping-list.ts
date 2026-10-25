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
  // Which concrete product the shopper meant, chosen in the cheapest-basket
  // refinement popup ("חלב" -> "תנובה 3% 1 ל'"). Shared like the rest of the item.
  variant?: ShoppingListItemVariant;
  // Which product the shopper meant when a mapped store carries several that
  // answer to the item's text in different places ("טחינה" -> the generic one or
  // the chain's own). Asked before routing; shared like the rest of the item.
  placeChoice?: ShoppingListItemPlaceChoice;
}

export interface ShoppingListItemPlaceChoice {
  // The chosen product; null = "לא משנה לי": whichever makes the route shortest.
  productId: string | null;
  // normalizeHebrewText(rawText) when chosen: editing the item asks again.
  text: string;
  chosenAt: string;
}

export interface ShoppingListItemVariant {
  // "sku": one specific product. "any": "לא משנה לי – הכי זול" — the cheapest typical
  // product in each branch.
  kind: "sku" | "any";
  // The generic product the choice was made for. If the item is later edited or
  // reclassified to another product, the choice no longer applies (see effectiveVariant).
  productId?: string;
  // The retail item key (barcode, or "<chain>:<code>") for kind "sku".
  itemKey?: string;
  // Display snapshot, e.g. "חלב בקרטון 3% שומן 1 ל".
  name?: string;
  chosenAt: string;
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
  // Pinned: a standing list (typically a household's) that stays on the home screen after
  // shopping - finishing clears what was bought instead of retiring the list.
  isPinned?: boolean;
  // Soft-delete marker; deleted lists are hidden but never hard-removed.
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
