import { beforeEach, describe, expect, it } from "vitest";
import { ClassificationService } from "@smartroute/core/application/classification/classification-service";
import { dictionaryLayer } from "@smartroute/core/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@smartroute/core/application/classification/layers/fuzzy-match-layer";
import { createLlmFallbackLayer } from "@smartroute/core/application/classification/layers/llm-fallback-layer";
import { normalizationLayer } from "@smartroute/core/application/classification/layers/normalization-layer";
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { IClassificationCacheRepository } from "@smartroute/core/application/ports/classification-cache-repository";
import type { IProductRepository } from "@smartroute/core/application/ports/product-repository";
import type {
  CatalogSummaryEntry,
  ILLMClassifier,
  LLMClassificationResult,
} from "@smartroute/core/application/ports/llm-classifier";
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

  it("re-checks a cached 'unresolved' against a catalog that has grown since, without the LLM", async () => {
    await cacheRepo.set("עגבניות", { rawText: "עגבניות", confidence: 0, source: "unresolved" });
    const result = await service.classify("עגבניות");
    expect(result.matchedProductId).toBe(productByName("עגבניות").id);
    expect(llm.calls).toBe(0);
    expect((await cacheRepo.get("עגבניות"))?.source).not.toBe("unresolved");
  });

  it("re-checks a cached fuzzy guess against today's catalog", async () => {
    const wrong = productByName("שוקולד חלב").id;
    await cacheRepo.set("מיץ תפוזים", { rawText: "מיץ תפוזים", matchedProductId: wrong, confidence: 0.7, source: "fuzzy" });
    const result = await service.classify("מיץ תפוזים");
    expect(result.matchedProductId).toBe(productByName("מיץ תפוזים").id);
    expect((await cacheRepo.get("מיץ תפוזים"))?.source).toBe("dictionary");
  });

  it("matches a line without its count, units or brand", async () => {
    for (const [line, product] of [
      ["3 חלב תנובה", "חלב 3% תנובה 1 ליטר"],
      ['2 ק"ג עגבניות', "עגבניות"],
      ["שישיית מים", "מים מינרליים"],
      ["קוטג' תנובה 5%", "קוטג'"],
      ["פיירי", "סבון כלים"],
    ]) {
      const result = await service.classify(line);
      expect(result.source, line).toBe("normalization");
      expect(result.matchedProductId, line).toBe(productByName(product).id);
    }
  });

  it("doesn't fuzzy-match a different kind of product that merely looks alike", async () => {
    expect((await service.classify("שוקו")).matchedProductId).not.toBe(productByName("שוקולד חלב").id);
    expect((await service.classify("תה שחור")).matchedProductId).not.toBe(productByName("קפה נמס").id);
    expect((await service.classify("צלי בקר")).matchedProductId).not.toBe(productByName("בצל יבש").id);
  });

  it("fuzzy-matches past a qualifier word or a swapped word order", async () => {
    expect((await service.classify("דג סלמון")).matchedProductId).toBe(productByName("פילה סלמון").id);
    expect((await service.classify("תירס שימורים")).matchedProductId).toBe(productByName("שימורי תירס").id);
  });

  it("prefers the product named exactly that over one that only has it as an alias", async () => {
    const generic = productByName("קפה נמס");
    const barista: Product = {
      ...generic,
      id: "barista",
      canonicalName: "קפה נמס בריסטה",
      aliases: ["קפה נמס"],
      normalizedAliases: ["קפה נמס בריסטה", "קפה נמס"],
    };
    // The alias-only product listed first, as the catalog order may have it.
    const withBarista = new ClassificationService(
      [dictionaryLayer, normalizationLayer, fuzzyMatchLayer],
      new FakeCacheRepository(),
      new FakeProductRepository([barista, ...demoProducts]),
    );
    expect((await withBarista.classify("קפה נמס")).matchedProductId).toBe(generic.id);
  });

  it("classifyBatch resolves every item and preserves order", async () => {
    const results = await service.classifyBatch(["עגבניות", "חלב תנובה", "xyzunknownproduct"]);
    expect(results).toHaveLength(3);
    expect(results[0].matchedProductId).toBe(productByName("עגבניות").id);
    expect(results[1].matchedProductId).toBe(productByName("חלב 3% תנובה 1 ליטר").id);
    expect(results[2].source).toBe("unresolved");
  });
});
