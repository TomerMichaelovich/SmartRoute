import { eq } from "drizzle-orm";
import type { Store } from "@/src/domain/entities/store";
import { db } from "../../db/client";
import { stores } from "../../db/schema";
import type { IStoreRepository } from "../interfaces/store-repository";
import { storeSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

export class PgStoreRepository implements IStoreRepository {
  async findAll(): Promise<Store[]> {
    const rows = await db.select().from(stores);
    return rows.map((row) => storeSchema.parse(row));
  }

  async findActive(): Promise<Store[]> {
    const rows = await db.select().from(stores).where(eq(stores.isActive, true));
    return rows.map((row) => storeSchema.parse(row));
  }

  async findById(id: string): Promise<Store | null> {
    const [row] = await db.select().from(stores).where(eq(stores.id, id));
    return row ? storeSchema.parse(row) : null;
  }

  async create(store: Store): Promise<Store> {
    await db.insert(stores).values(store);
    return store;
  }

  async update(id: string, patch: Partial<Store>): Promise<Store> {
    const [row] = await db
      .update(stores)
      .set(cleanPatch(patch))
      .where(eq(stores.id, id))
      .returning();
    if (!row) throw new Error(`Store not found: ${id}`);
    return storeSchema.parse(row);
  }

  async delete(id: string): Promise<void> {
    await db.delete(stores).where(eq(stores.id, id));
  }
}
