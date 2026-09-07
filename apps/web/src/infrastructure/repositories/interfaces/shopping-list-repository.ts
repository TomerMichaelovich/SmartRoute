import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";

export interface CheckedBy {
  userId: string;
  name: string;
}

export interface AttachToOwnerOptions {
  name?: string;
  /** Also make this the owner's active list (deactivating the others). */
  activate?: boolean;
}

export interface IShoppingListRepository {
  findById(id: string): Promise<ShoppingList | null>;
  findByShareCode(shareCode: string): Promise<ShoppingList | null>;
  create(list: ShoppingList): Promise<ShoppingList>;
  updateItems(id: string, items: ShoppingList["items"], updatedAt: string): Promise<void>;

  /** A user's own personal lists, newest activity first, excluding soft-deleted. */
  findByOwner(userId: string): Promise<ShoppingList[]>;
  findActiveByOwner(userId: string): Promise<ShoppingList | null>;
  /** The household's single shared list, if one exists. */
  findByHousehold(householdId: string): Promise<ShoppingList | null>;

  // --- Granular item mutations (atomic single-statement jsonb updates, so
  //     concurrent household edits merge instead of clobbering each other). ---
  appendItems(listId: string, items: ShoppingListItem[]): Promise<void>;
  removeItem(listId: string, itemId: string): Promise<void>;
  setItemQuantity(listId: string, itemId: string, quantity: number | null): Promise<void>;
  setItemChecked(listId: string, itemId: string, checked: boolean, by: CheckedBy | null): Promise<void>;
  setItemNotFound(listId: string, itemId: string, notFound: boolean): Promise<void>;

  /** Claim a currently-ownerless (guest) list for a user. */
  attachToOwner(listId: string, userId: string, options?: AttachToOwnerOptions): Promise<void>;
  /** Make one of the user's lists active; all their other lists become inactive. */
  setActive(listId: string, userId: string): Promise<void>;
  rename(listId: string, name: string): Promise<void>;
  softDelete(listId: string, deletedAt: string): Promise<void>;
}
