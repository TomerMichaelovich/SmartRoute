import type { Store } from "@/src/domain/entities/store";
import type { IStoreRepository } from "../interfaces/store-repository";
import { JsonFileStore } from "./json-file-store";
import { storeSchema } from "./schemas";

export class JsonStoreRepository implements IStoreRepository {
  private readonly store = new JsonFileStore<Store>("stores.json", storeSchema);

  async findAll(): Promise<Store[]> {
    return this.store.readAll();
  }

  async findActive(): Promise<Store[]> {
    const all = await this.store.readAll();
    return all.filter((s) => s.isActive);
  }

  async findById(id: string): Promise<Store | null> {
    const all = await this.store.readAll();
    return all.find((s) => s.id === id) ?? null;
  }

  async create(store: Store): Promise<Store> {
    await this.store.mutate((items) => [...items, store]);
    return store;
  }

  async update(id: string, patch: Partial<Store>): Promise<Store> {
    let updated: Store | undefined;
    await this.store.mutate((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      }),
    );
    if (!updated) throw new Error(`Store not found: ${id}`);
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.store.mutate((items) => items.filter((item) => item.id !== id));
  }
}
