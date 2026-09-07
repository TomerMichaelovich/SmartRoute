import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";

export interface IClassificationCacheRepository {
  get(normalizedKey: string): Promise<ClassificationResult | null>;
  set(normalizedKey: string, result: ClassificationResult): Promise<void>;
  delete(normalizedKey: string): Promise<void>;
}
