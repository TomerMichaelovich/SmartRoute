import type { ShoppingList } from "@/src/domain/entities/shopping-list";
import type { IShoppingListRepository } from "../interfaces/shopping-list-repository";
import { JsonFileStore } from "./json-file-store";
import { shoppingListSchema } from "./schemas";

export class JsonShoppingListRepository implements IShoppingListRepository {
  private readonly store = new JsonFileStore<ShoppingList>(
    "shopping-lists.json",
    shoppingListSchema,
  );

  async findById(id: string): Promise<ShoppingList | null> {
    const all = await this.store.readAll();
    return all.find((l) => l.id === id) ?? null;
  }

  async create(list: ShoppingList): Promise<ShoppingList> {
    await this.store.mutate((items) => [...items, list]);
    return list;
  }
}
