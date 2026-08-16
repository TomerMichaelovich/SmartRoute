import { eq } from "drizzle-orm";
import type { ShoppingList } from "@/src/domain/entities/shopping-list";
import { db } from "../../db/client";
import { shoppingLists } from "../../db/schema";
import type { IShoppingListRepository } from "../interfaces/shopping-list-repository";
import { shoppingListSchema } from "../schemas";

export class PgShoppingListRepository implements IShoppingListRepository {
  async findById(id: string): Promise<ShoppingList | null> {
    const [row] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id));
    return row ? shoppingListSchema.parse(row) : null;
  }

  async create(list: ShoppingList): Promise<ShoppingList> {
    await db.insert(shoppingLists).values(list);
    return list;
  }
}
