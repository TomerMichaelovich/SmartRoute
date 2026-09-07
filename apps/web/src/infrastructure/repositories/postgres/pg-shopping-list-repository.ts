import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { db } from "../../db/client";
import { shoppingLists } from "../../db/schema";
import type {
  AttachToOwnerOptions,
  CheckedBy,
  IShoppingListRepository,
} from "../interfaces/shopping-list-repository";
import { shoppingListSchema } from "../schemas";

export class PgShoppingListRepository implements IShoppingListRepository {
  async findById(id: string): Promise<ShoppingList | null> {
    const [row] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id));
    return row ? shoppingListSchema.parse(row) : null;
  }

  async findByShareCode(shareCode: string): Promise<ShoppingList | null> {
    const [row] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.shareCode, shareCode));
    return row ? shoppingListSchema.parse(row) : null;
  }

  async create(list: ShoppingList): Promise<ShoppingList> {
    await db.insert(shoppingLists).values(list);
    return list;
  }

  async updateItems(id: string, items: ShoppingList["items"], updatedAt: string): Promise<void> {
    await db.update(shoppingLists).set({ items, updatedAt }).where(eq(shoppingLists.id, id));
  }

  async findByOwner(userId: string): Promise<ShoppingList[]> {
    const rows = await db
      .select()
      .from(shoppingLists)
      .where(
        and(eq(shoppingLists.ownerUserId, userId), isNull(shoppingLists.deletedAt)),
      )
      .orderBy(desc(shoppingLists.updatedAt));
    return rows.map((row) => shoppingListSchema.parse(row));
  }

  async findActiveByOwner(userId: string): Promise<ShoppingList | null> {
    const [row] = await db
      .select()
      .from(shoppingLists)
      .where(
        and(
          eq(shoppingLists.ownerUserId, userId),
          eq(shoppingLists.isActive, true),
          isNull(shoppingLists.deletedAt),
        ),
      )
      .orderBy(desc(shoppingLists.updatedAt));
    return row ? shoppingListSchema.parse(row) : null;
  }

  async findByHousehold(householdId: string): Promise<ShoppingList | null> {
    const [row] = await db
      .select()
      .from(shoppingLists)
      .where(
        and(eq(shoppingLists.householdId, householdId), isNull(shoppingLists.deletedAt)),
      )
      .orderBy(desc(shoppingLists.createdAt));
    return row ? shoppingListSchema.parse(row) : null;
  }

  async appendItems(listId: string, items: ShoppingListItem[]): Promise<void> {
    await db
      .update(shoppingLists)
      .set({
        items: sql`${shoppingLists.items} || ${JSON.stringify(items)}::jsonb`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shoppingLists.id, listId));
  }

  async removeItem(listId: string, itemId: string): Promise<void> {
    await db
      .update(shoppingLists)
      .set({
        items: sql`COALESCE((SELECT jsonb_agg(e) FROM jsonb_array_elements(${shoppingLists.items}) e WHERE e->>'id' <> ${itemId}), '[]'::jsonb)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shoppingLists.id, listId));
  }

  async setItemQuantity(listId: string, itemId: string, quantity: number | null): Promise<void> {
    const patch = quantity === null ? sql`(e - 'quantity')` : sql`(e || ${JSON.stringify({ quantity })}::jsonb)`;
    await this.mapMatchingItem(listId, itemId, patch);
  }

  async setItemChecked(
    listId: string,
    itemId: string,
    checked: boolean,
    by: CheckedBy | null,
  ): Promise<void> {
    const patch = checked
      ? sql`(e || ${JSON.stringify({
          checked: true,
          checkedByUserId: by?.userId,
          checkedByName: by?.name,
          checkedAt: new Date().toISOString(),
        })}::jsonb)`
      : sql`((e - 'checkedByUserId' - 'checkedByName' - 'checkedAt') || '{"checked":false}'::jsonb)`;
    await this.mapMatchingItem(listId, itemId, patch);
  }

  async setItemNotFound(listId: string, itemId: string, notFound: boolean): Promise<void> {
    await this.mapMatchingItem(
      listId,
      itemId,
      sql`(e || ${JSON.stringify({ notFound })}::jsonb)`,
    );
  }

  /** Atomic: rebuilds the items array applying `patchExpr` to the one matching element. */
  private async mapMatchingItem(
    listId: string,
    itemId: string,
    patchExpr: ReturnType<typeof sql>,
  ): Promise<void> {
    await db
      .update(shoppingLists)
      .set({
        items: sql`(SELECT jsonb_agg(CASE WHEN e->>'id' = ${itemId} THEN ${patchExpr} ELSE e END) FROM jsonb_array_elements(${shoppingLists.items}) e)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(shoppingLists.id, listId));
  }

  async attachToOwner(
    listId: string,
    userId: string,
    options: AttachToOwnerOptions = {},
  ): Promise<void> {
    if (options.activate) {
      await this.deactivateAll(userId);
    }
    const patch: Record<string, unknown> = { ownerUserId: userId };
    if (options.name !== undefined) patch.name = options.name;
    if (options.activate) patch.isActive = true;
    await db.update(shoppingLists).set(patch).where(eq(shoppingLists.id, listId));
  }

  async setActive(listId: string, userId: string): Promise<void> {
    // One statement: true for the target row, false for every other list this
    // user owns. Atomic on the neon-http driver (no interactive transactions).
    await db
      .update(shoppingLists)
      .set({ isActive: sql`(${shoppingLists.id} = ${listId})` })
      .where(
        and(eq(shoppingLists.ownerUserId, userId), isNull(shoppingLists.deletedAt)),
      );
  }

  async rename(listId: string, name: string): Promise<void> {
    await db.update(shoppingLists).set({ name }).where(eq(shoppingLists.id, listId));
  }

  async softDelete(listId: string, deletedAt: string): Promise<void> {
    await db
      .update(shoppingLists)
      .set({ deletedAt, isActive: false })
      .where(eq(shoppingLists.id, listId));
  }

  private async deactivateAll(userId: string): Promise<void> {
    await db
      .update(shoppingLists)
      .set({ isActive: false })
      .where(eq(shoppingLists.ownerUserId, userId));
  }
}
