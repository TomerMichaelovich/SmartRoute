import { asc, eq } from "drizzle-orm";
import type { AnalyticsEvent } from "@smartroute/core/domain/entities/analytics-event";
import { db } from "../../db/client";
import { analyticsEvents } from "../../db/schema";
import type { IAnalyticsRepository } from "../interfaces/analytics-repository";
import { analyticsEventSchema } from "../schemas";

function toDomain(row: typeof analyticsEvents.$inferSelect): AnalyticsEvent {
  return analyticsEventSchema.parse({
    ...row,
    userId: row.userId ?? undefined,
    storeId: row.storeId ?? undefined,
    routeId: row.routeId ?? undefined,
  });
}

export class PgAnalyticsRepository implements IAnalyticsRepository {
  async append(event: AnalyticsEvent): Promise<void> {
    await db.insert(analyticsEvents).values(event);
  }

  async readAll(): Promise<AnalyticsEvent[]> {
    const rows = await db.select().from(analyticsEvents).orderBy(asc(analyticsEvents.timestamp));
    return rows.map(toDomain);
  }

  async findByUser(userId: string): Promise<AnalyticsEvent[]> {
    const rows = await db
      .select()
      .from(analyticsEvents)
      .where(eq(analyticsEvents.userId, userId))
      .orderBy(asc(analyticsEvents.timestamp));
    return rows.map(toDomain);
  }

  async deleteByStoreId(storeId: string): Promise<void> {
    await db.delete(analyticsEvents).where(eq(analyticsEvents.storeId, storeId));
  }
}
