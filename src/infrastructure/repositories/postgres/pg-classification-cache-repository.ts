import { eq } from "drizzle-orm";
import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import { db } from "../../db/client";
import { classificationCache } from "../../db/schema";
import type { IClassificationCacheRepository } from "../interfaces/classification-cache-repository";
import { classificationResultSchema } from "../schemas";

export class PgClassificationCacheRepository implements IClassificationCacheRepository {
  async get(normalizedKey: string): Promise<ClassificationResult | null> {
    const [row] = await db
      .select()
      .from(classificationCache)
      .where(eq(classificationCache.normalizedKey, normalizedKey));
    return row ? classificationResultSchema.parse(row.result) : null;
  }

  async set(normalizedKey: string, result: ClassificationResult): Promise<void> {
    const validated = classificationResultSchema.parse(result);
    await db
      .insert(classificationCache)
      .values({ normalizedKey, result: validated })
      .onConflictDoUpdate({
        target: classificationCache.normalizedKey,
        set: { result: validated },
      });
  }

  async delete(normalizedKey: string): Promise<void> {
    await db.delete(classificationCache).where(eq(classificationCache.normalizedKey, normalizedKey));
  }
}
