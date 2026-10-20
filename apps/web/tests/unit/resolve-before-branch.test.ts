import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { resolveBeforeBranch } from "@smartroute/core/application/classification/resolve-before-branch";
import type { ClassificationResult } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";

function product(id: string, canonicalName: string, aliases: string[] = [], chainId?: string): Product {
  return {
    id,
    canonicalName,
    aliases,
    normalizedAliases: [canonicalName, ...aliases].map(normalizeHebrewText),
    category: "pantry",
    department: "כללי",
    isActive: true,
    chainId,
  };
}

const genericCoffee = product("generic-coffee", "קפה נמס");
const baristaCoffee = product("barista", "קפה נמס בריסטה", ["קפה נמס"], "רמי לוי");
const milk = product("milk", "חלב");
const products = [genericCoffee, baristaCoffee, milk];

describe("resolveBeforeBranch", () => {
  it("keeps a generic match as is", () => {
    const result: ClassificationResult = { rawText: "חלב", matchedProductId: "milk", confidence: 1, source: "dictionary" };
    expect(resolveBeforeBranch(result, products)).toEqual(result);
  });

  it("swaps a chain product for the generic product of the same exact name", () => {
    const result: ClassificationResult = { rawText: "קפה נמס", matchedProductId: "barista", confidence: 1, source: "dictionary" };
    expect(resolveBeforeBranch(result, products)).toMatchObject({ matchedProductId: "generic-coffee", confidence: 1 });
  });

  it("keeps a chain product the shopper named exactly", () => {
    const result: ClassificationResult = {
      rawText: "קפה נמס בריסטה",
      matchedProductId: "barista",
      confidence: 1,
      source: "dictionary",
    };
    expect(resolveBeforeBranch(result, products).matchedProductId).toBe("barista");
  });

  it("re-does a fuzzy chain-product guess against generic products only", () => {
    const result: ClassificationResult = {
      rawText: "קפה נמס בריסוה",
      matchedProductId: "barista",
      confidence: 0.82,
      source: "fuzzy",
      alternativeMatches: [
        { productId: "barista", confidence: 0.82 },
        { productId: "generic-coffee", confidence: 0.63 },
      ],
    };
    const resolved = resolveBeforeBranch(result, products);
    expect(resolved.matchedProductId).toBe("generic-coffee");
    expect(resolved.alternativeMatches?.map((a) => a.productId)).not.toContain("barista");
  });

  it("never suggests chain products for an unresolved item", () => {
    const result: ClassificationResult = {
      rawText: "קפה בריסט",
      confidence: 0,
      source: "unresolved",
      alternativeMatches: [{ productId: "barista", confidence: 0.5 }],
    };
    const resolved = resolveBeforeBranch(result, products);
    expect(resolved.alternativeMatches?.map((a) => a.productId) ?? []).not.toContain("barista");
  });
});
