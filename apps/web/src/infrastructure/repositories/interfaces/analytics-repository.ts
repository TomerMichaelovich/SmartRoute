import type { AnalyticsEvent } from "@smartroute/core/domain/entities/analytics-event";

export interface IAnalyticsRepository {
  append(event: AnalyticsEvent): Promise<void>;
  readAll(): Promise<AnalyticsEvent[]>;
  deleteByStoreId(storeId: string): Promise<void>;
}
