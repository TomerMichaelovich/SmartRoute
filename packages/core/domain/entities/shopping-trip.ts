/**
 * An immutable record of one completed shopping trip. Written once when the
 * shopper taps "finished shopping" and never updated afterwards - editing the
 * shopping list it came from must not change history. Every field is a copy,
 * not a reference.
 */
export interface ShoppingTripItem {
  rawText: string;
  quantity?: number;
  /** Resolved product display name at trip time (null if it was never matched). */
  productName: string | null;
  collected: boolean;
  notFound: boolean;
}

export interface ShoppingTrip {
  id: string;
  /** Whose history this belongs to. Guests get no server-side history. */
  userId: string | null;
  householdId: string | null;
  storeId: string;
  storeName: string;
  routeId: string | null;
  shoppingListId: string | null;
  startedAt: string;
  completedAt: string;
  items: ShoppingTripItem[];
  createdAt: string;
}
