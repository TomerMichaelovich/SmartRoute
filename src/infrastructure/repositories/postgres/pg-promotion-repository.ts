import { eq } from "drizzle-orm";
import type { Promotion } from "@/src/domain/entities/promotion";
import { db } from "../../db/client";
import { promotions } from "../../db/schema";
import type { IPromotionRepository } from "../interfaces/promotion-repository";
import { promotionSchema } from "../schemas";
import { cleanPatch } from "./patch-utils";

function toDomain(row: typeof promotions.$inferSelect): Promotion {
  return promotionSchema.parse({
    ...row,
    storeId: row.storeId ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    startDate: row.startDate ?? undefined,
    endDate: row.endDate ?? undefined,
  });
}

export class PgPromotionRepository implements IPromotionRepository {
  async findAll(): Promise<Promotion[]> {
    const rows = await db.select().from(promotions);
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Promotion | null> {
    const [row] = await db.select().from(promotions).where(eq(promotions.id, id));
    return row ? toDomain(row) : null;
  }

  async create(promotion: Promotion): Promise<Promotion> {
    await db.insert(promotions).values(promotion);
    return promotion;
  }

  async update(id: string, patch: Partial<Promotion>): Promise<Promotion> {
    const [row] = await db
      .update(promotions)
      .set(cleanPatch(patch))
      .where(eq(promotions.id, id))
      .returning();
    if (!row) throw new Error(`Promotion not found: ${id}`);
    return toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await db.delete(promotions).where(eq(promotions.id, id));
  }
}
