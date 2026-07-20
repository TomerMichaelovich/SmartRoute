import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import type { IClassificationCacheRepository } from "../interfaces/classification-cache-repository";
import { JsonObjectFileStore } from "./json-file-store";
import { classificationResultSchema } from "./schemas";

export class JsonClassificationCacheRepository implements IClassificationCacheRepository {
  private readonly store = new JsonObjectFileStore<ClassificationResult>(
    "classification-cache.json",
    classificationResultSchema,
  );

  async get(normalizedKey: string): Promise<ClassificationResult | null> {
    return this.store.get(normalizedKey);
  }

  async set(normalizedKey: string, result: ClassificationResult): Promise<void> {
    await this.store.set(normalizedKey, result);
  }

  async delete(normalizedKey: string): Promise<void> {
    await this.store.delete(normalizedKey);
  }
}
