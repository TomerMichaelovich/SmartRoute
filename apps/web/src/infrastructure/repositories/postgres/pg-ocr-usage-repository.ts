import { and, count, eq, gte } from "drizzle-orm";
import { db } from "../../db/client";
import { ocrRequests } from "../../db/schema";
import type { IOcrUsageRepository } from "../interfaces/ocr-usage-repository";

export class PgOcrUsageRepository implements IOcrUsageRepository {
  async countSince(userId: string, sinceIso: string): Promise<number> {
    const [row] = await db
      .select({ n: count() })
      .from(ocrRequests)
      .where(and(eq(ocrRequests.userId, userId), gte(ocrRequests.createdAt, sinceIso)));
    return row?.n ?? 0;
  }

  async record(userId: string): Promise<void> {
    await db
      .insert(ocrRequests)
      .values({ id: crypto.randomUUID(), userId, createdAt: new Date().toISOString() });
  }
}
