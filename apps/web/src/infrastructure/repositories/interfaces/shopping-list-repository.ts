import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";

export interface CheckedBy {
  userId: string;
  name: string;
}

export interface AttachToOwnerOptions {
  name?: string;
  /** Also make this one of the owner's active (open, on-the-home-screen) lists. */
  activate?: boolean;
}

export interface IShoppingListRepository {
  findById(id: string): Promise<ShoppingList | null>;
  findByShareCode(shareCode: string): Promise<ShoppingList | null>;
  create(list: ShoppingList): Promise<ShoppingList>;
  updateItems(id: string, items: ShoppingList["items"], updatedAt: string): Promise<void>;

  /** A user's own personal lists, newest activity first, excluding soft-deleted. */
  findByOwner(userId: string): Promise<ShoppingList[]>;
  /** The most recently updated of the user's active lists. */
  findActiveByOwner(userId: string): Promise<ShoppingList | null>;
  /** All of a user's active lists - the ones open on their home screen. */
  findAllActiveByOwner(userId: string): Promise<ShoppingList[]>;
  /** The household's single shared list, if one exists. */
  findByHousehold(householdId: string): Promise<ShoppingList | null>;
  /**
   * Lists other people shared with this user (they're an active member of the
   * list's sharing group) that are still open: active, or legacy ownerless
   * household lists, which never close.
   */
  findSharedWithUser(userId: string): Promise<ShoppingList[]>;
  /** Attaches a list to its sharing group (a household row), making it shared. */
  setHousehold(listId: string, householdId: string): Promise<void>;

  // --- Granular item mutations (atomic single-statement jsonb updates, so
  //     concurrent household edits merge instead of clobbering each other). ---
  appendItems(listId: string, items: ShoppingListItem[]): Promise<void>;
  removeItem(listId: string, itemId: string): Promise<void>;
  setItemQuantity(listId: string, itemId: string, quantity: number | null): Promise<void>;
  setItemChecked(listId: string, itemId: string, checked: boolean, by: CheckedBy | null): Promise<void>;
  setItemNotFound(listId: string, itemId: string, notFound: boolean): Promise<void>;

  /** Claim a currently-ownerless (guest) list for a user. */
  attachToOwner(listId: string, userId: string, options?: AttachToOwnerOptions): Promise<void>;
  /** Put one of the user's lists (back) on their home screen. Several lists may be active at once. */
  setActive(listId: string, userId: string): Promise<void>;
  /** Take a list off its owner's home screen (e.g. once shopping with it is finished). */
  deactivate(listId: string): Promise<void>;
  rename(listId: string, name: string): Promise<void>;
  softDelete(listId: string, deletedAt: string): Promise<void>;
}
