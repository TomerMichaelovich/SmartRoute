import type { AnalyticsEvent } from "@smartroute/core/domain/entities/analytics-event";

export interface IAnalyticsRepository {
  append(event: AnalyticsEvent): Promise<void>;
  readAll(): Promise<AnalyticsEvent[]>;
  /** One signed-in user's events, oldest first. */
  findByUser(userId: string): Promise<AnalyticsEvent[]>;
  deleteByStoreId(storeId: string): Promise<void>;
}
