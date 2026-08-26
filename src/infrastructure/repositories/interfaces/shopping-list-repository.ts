import type { ShoppingList } from "@/src/domain/entities/shopping-list";

export interface IShoppingListRepository {
  findById(id: string): Promise<ShoppingList | null>;
  findByShareCode(shareCode: string): Promise<ShoppingList | null>;
  create(list: ShoppingList): Promise<ShoppingList>;
  updateItems(id: string, items: ShoppingList["items"], updatedAt: string): Promise<void>;
}
