import { beforeEach, describe, expect, it } from "vitest";
import { ClassificationService } from "@/src/application/classification/classification-service";
import { dictionaryLayer } from "@/src/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@/src/application/classification/layers/fuzzy-match-layer";
import { createLlmFallbackLayer } from "@/src/application/classification/layers/llm-fallback-layer";
import { normalizationLayer } from "@/src/application/classification/layers/normalization-layer";
import type { ClassificationResult } from "@/src/domain/entities/classification-result";
import type { Product } from "@/src/domain/entities/product";
import type { IClassificationCacheRepository } from "@/src/infrastructure/repositories/interfaces/classification-cache-repository";
import type { IProductRepository } from "@/src/infrastructure/repositories/interfaces/product-repository";
import type {
  CatalogSummaryEntry,
  ILLMClassifier,
  LLMClassificationResult,
} from "@/src/infrastructure/llm/llm-classifier.interface";
import { demoProducts } from "@/tests/fixtures/demo-store.fixture";

class FakeProductRepository implements IProductRepository {
  constructor(private readonly products: Product[]) {}
  async findAllActive() {
    return this.products.filter((p) => p.isActive);
  }
  async findAll() {
    return this.products;
  }
  async findById(id: string) {
    return this.products.find((p) => p.id === id) ?? null;
  }
  async create(p: Product) {
    this.products.push(p);
    return p;
  }
  async update(id: string, patch: Partial<Product>) {
    const idx = this.products.findIndex((p) => p.id === id);
    this.products[idx] = { ...this.products[idx], ...patch };
    return this.products[idx];
  }
}

class FakeCacheRepository implements IClassificationCacheRepository {
  private readonly cache = new Map<string, ClassificationResult>();
  async get(key: string) {
    return this.cache.get(key) ?? null;
  }
  async set(key: string, result: ClassificationResult) {
    this.cache.set(key, result);
  }
  async delete(key: string) {
    this.cache.delete(key);
  }
  get size() {
    return this.cache.size;
  }
}

class CountingLlmClassifier implements ILLMClassifier {
  calls = 0;
  async classifyProduct(
    _rawText: string,
    _catalogSummary: CatalogSummaryEntry[],
  ): Promise<LLMClassificationResult> {
    this.calls += 1;
    return { confidence: 0 };
  }
}

function productByName(name: string): Product {
  const product = demoProducts.find((p) => p.canonicalName === name);
  if (!product) throw new Error(`Fixture missing expected product: ${name}`);
  return product;
}

describe("ClassificationService", () => {
  let cacheRepo: FakeCacheRepository;
  let llm: CountingLlmClassifier;
  let service: ClassificationService;

  beforeEach(() => {
    cacheRepo = new FakeCacheRepository();
    llm = new CountingLlmClassifier();
    const productRepo = new FakeProductRepository([...demoProducts]);
    service = new ClassificationService(
      [dictionaryLayer, normalizationLayer, fuzzyMatchLayer, createLlmFallbackLayer(llm)],
      cacheRepo,
      productRepo,
    );
  });

  it("matches an exact canonical name via the dictionary layer", async () => {
    const result = await service.classify("עגבניות");
    expect(result.source).toBe("dictionary");
    expect(result.confidence).toBe(1);
    expect(result.matchedProductId).toBe(productByName("עגבניות").id);
  });

  it("matches a known alias via the dictionary layer", async () => {
    const result = await service.classify("חלב תנובה");
    expect(result.source).toBe("dictionary");
    expect(result.matchedProductId).toBe(productByName("חלב 3% תנובה 1 ליטר").id);
  });

  it("resolves a slang synonym via the normalization layer", async () => {
    const result = await service.classify("קוק");
    expect(result.source).toBe("normalization");
    expect(result.matchedProductId).toBe(productByName("קוקה קולה 1.5 ליטר").id);
  });

  it("resolves a bound-prefix variant via the normalization layer", async () => {
    const result = await service.classify("ומים");
    expect(result.source).toBe("normalization");
    expect(result.matchedProductId).toBe(productByName("מים מינרליים").id);
  });

  it("resolves an unaliased plural via suffix stripping in the normalization layer", async () => {
    const result = await service.classify("בגטים");
    expect(result.source).toBe("normalization");
    expect(result.matchedProductId).toBe(productByName("בגט").id);
  });

  it("resolves a typo via the fuzzy layer with alternatives for low-confidence picks", async () => {
    const result = await service.classify("עגבניוט");
    expect(result.source).toBe("fuzzy");
    expect(result.matchedProductId).toBe(productByName("עגבניות").id);
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.confidence).toBeLessThan(0.85);
    expect(result.alternativeMatches?.length).toBeGreaterThan(0);
  });

  it("falls through to unresolved for a nonsense string and calls the LLM layer once", async () => {
    const result = await service.classify("xyzunknownproduct12345");
    expect(result.source).toBe("unresolved");
    expect(result.matchedProductId).toBeUndefined();
    expect(llm.calls).toBe(1);
  });

  it("caches every outcome so the same normalized text is never reclassified", async () => {
    await service.classify("xyzunknownproduct12345");
    await service.classify("xyzunknownproduct12345");
    await service.classify("XYZUnknownProduct12345"); // same after normalization (lowercased)
    expect(llm.calls).toBe(1);
    expect(cacheRepo.size).toBe(1);
  });

  it("classifyBatch resolves every item and preserves order", async () => {
    const results = await service.classifyBatch(["עגבניות", "חלב תנובה", "xyzunknownproduct"]);
    expect(results).toHaveLength(3);
    expect(results[0].matchedProductId).toBe(productByName("עגבניות").id);
    expect(results[1].matchedProductId).toBe(productByName("חלב 3% תנובה 1 ליטר").id);
    expect(results[2].source).toBe("unresolved");
  });
});
