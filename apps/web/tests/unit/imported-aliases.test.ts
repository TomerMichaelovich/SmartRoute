import { describe, expect, it } from "vitest";
import { ClassificationService } from "@smartroute/core/application/classification/classification-service";
import { buildAliasIndex, exactAliasMatch } from "@smartroute/core/application/classification/imported-aliases";
import { dictionaryLayer } from "@smartroute/core/application/classification/layers/dictionary-layer";
import { fuzzyMatchLayer } from "@smartroute/core/application/classification/layers/fuzzy-match-layer";
import { importedAliasLayer } from "@smartroute/core/application/classification/layers/imported-alias-layer";
import { normalizationLayer } from "@smartroute/core/application/classification/layers/normalization-layer";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { IClassificationCacheRepository } from "@smartroute/core/application/ports/classification-cache-repository";
import type { IProductRepository } from "@smartroute/core/application/ports/product-repository";

function product(id: string, canonicalName: string, aliases: string[] = []): Product {
  return {
    id,
    canonicalName,
    aliases,
    normalizedAliases: [canonicalName, ...aliases].map(normalizeHebrewText),
    category: "other",
    department: "שונות",
    isActive: true,
  };
}

const index = buildAliasIndex([
  { alias: "ג'ין", shelfGroup: "spirits", products: 3 },
  { alias: "בילואו", shelfGroup: "spirits", products: 2 },
  { alias: "פיצה", shelfGroup: "frozen-pizza-meals", products: 4 },
  { alias: "במבה", shelfGroup: "salty-snacks", products: 5 },
  // One alias in two groups: the one most of its products stand in counts.
  { alias: "עוגיות", shelfGroup: "toys-games", products: 1 },
  { alias: "עוגיות", shelfGroup: "cookies-biscuits", products: 9 },
]);

function serviceWith(catalog: Product[]) {
  const memory = new Map<string, ClassificationResult>();
  const cache: IClassificationCacheRepository = {
    get: async (key) => memory.get(key) ?? null,
    set: async (key, result) => void memory.set(key, result),
    delete: async (key) => void memory.delete(key),
  };
  const products = { findCatalog: async () => catalog } as unknown as IProductRepository;
  return new ClassificationService(
    [dictionaryLayer, normalizationLayer, importedAliasLayer, fuzzyMatchLayer],
    cache,
    products,
    { aliasIndex: async () => index },
  );
}

describe("imported products' aliases in classification", () => {
  it("recognizes a line no generic product names, without picking one product", async () => {
    const result = await serviceWith([product("milk", "חלב")]).classify("ג'ין");
    expect(result).toMatchObject({ source: "alias", matchedAlias: "ג'ין", confidence: 1, category: "beverages" });
    expect(result.matchedProductId).toBeUndefined();
    expect(result.department).toBeTruthy();
  });

  it("looks past counts and punctuation", async () => {
    expect((await serviceWith([]).classify("2 גין")).matchedAlias).toBe("ג'ין");
  });

  it("leaves a line a generic product names to it", async () => {
    const result = await serviceWith([product("bamba", "במבה")]).classify("במבה");
    expect(result).toMatchObject({ source: "dictionary", matchedProductId: "bamba" });
    expect(result.matchedAlias).toBeUndefined();
  });

  it("takes the stores' own name over a generic product that merely looks alike", async () => {
    const result = await serviceWith([product("eggs", "ביצים", ["ביצה"])]).classify("פיצה");
    expect(result.matchedProductId).toBeUndefined();
    expect(result.matchedAlias).toBe("פיצה");
  });

  it("corrects a typo to an alias", async () => {
    const result = await serviceWith([product("milk", "חלב")]).classify("בילאו");
    expect(result).toMatchObject({ source: "fuzzy", matchedAlias: "בילואו" });
  });

  it("prefers the generic product on an equally close typo", async () => {
    const result = await serviceWith([product("bamba", "במבה")]).classify("במבע");
    expect(result.matchedProductId).toBe("bamba");
  });

  it("re-checks a cached alias once the catalog has a product for it", async () => {
    const catalog = [product("milk", "חלב")];
    const service = serviceWith(catalog);
    expect((await service.classify("ג'ין")).source).toBe("alias");
    catalog.push(product("gin", "ג'ין"));
    expect(await service.classify("ג'ין")).toMatchObject({ source: "dictionary", matchedProductId: "gin" });
  });

  it("files an alias under the group most of its products stand in", () => {
    expect(exactAliasMatch("עוגיות", index)?.category).toBe("snacks");
  });
});
