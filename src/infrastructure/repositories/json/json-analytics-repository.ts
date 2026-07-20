import type { AnalyticsEvent } from "@/src/domain/entities/analytics-event";
import type { IAnalyticsRepository } from "../interfaces/analytics-repository";
import { JsonLinesFileStore } from "./json-file-store";
import { analyticsEventSchema } from "./schemas";

export class JsonAnalyticsRepository implements IAnalyticsRepository {
  private readonly store = new JsonLinesFileStore<AnalyticsEvent>(
    "analytics-events.jsonl",
    analyticsEventSchema,
  );

  async append(event: AnalyticsEvent): Promise<void> {
    await this.store.append(event);
  }

  async readAll(): Promise<AnalyticsEvent[]> {
    return this.store.readAll();
  }
}
