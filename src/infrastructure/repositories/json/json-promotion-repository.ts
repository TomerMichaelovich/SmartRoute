import type { Promotion } from "@/src/domain/entities/promotion";
import type { IPromotionRepository } from "../interfaces/promotion-repository";
import { JsonFileStore } from "./json-file-store";
import { promotionSchema } from "./schemas";

export class JsonPromotionRepository implements IPromotionRepository {
  private readonly store = new JsonFileStore<Promotion>("promotions.json", promotionSchema);

  async findAll(): Promise<Promotion[]> {
    return this.store.readAll();
  }

  async findById(id: string): Promise<Promotion | null> {
    const all = await this.store.readAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async create(promotion: Promotion): Promise<Promotion> {
    await this.store.mutate((items) => [...items, promotion]);
    return promotion;
  }

  async update(id: string, patch: Partial<Promotion>): Promise<Promotion> {
    let updated: Promotion | undefined;
    await this.store.mutate((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        updated = { ...item, ...patch, id: item.id };
        return updated;
      }),
    );
    if (!updated) throw new Error(`Promotion not found: ${id}`);
    return updated;
  }
}
