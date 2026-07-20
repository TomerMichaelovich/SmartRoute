import type { AnalyticsEvent } from "@/src/domain/entities/analytics-event";

export interface IAnalyticsRepository {
  append(event: AnalyticsEvent): Promise<void>;
  readAll(): Promise<AnalyticsEvent[]>;
}
