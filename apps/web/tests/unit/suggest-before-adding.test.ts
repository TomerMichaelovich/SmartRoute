import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { suggestBeforeAdding } from "@smartroute/core/application/classification/suggest-before-adding";
import type { Product } from "@smartroute/core/domain/entities/product";

function product(id: string, canonicalName: string, aliases: string[] = [], chainId?: string): Product {
  return {
    id,
    canonicalName,
    aliases,
    normalizedAliases: [canonicalName, ...aliases].map(normalizeHebrewText),
    category: "beverages",
    department: "משקאות",
    isActive: true,
    chainId,
  };
}

const products = [
  product("cola", "קולה"),
  product("milk", "חלב"),
  product("tomatoes", "עגבניות"),
  product("barista", "קפה נמס בריסטה", [], "רמי לוי"),
  product("coffee", "קפה נמס"),
];

describe("suggestBeforeAdding", () => {
  it("lets an exact name through", async () => {
    expect(await suggestBeforeAdding("קולה", products)).toEqual([]);
  });

  it("lets a prefixed/plural form through (normalization layer)", async () => {
    expect(await suggestBeforeAdding("החלב", products)).toEqual([]);
  });

  it("suggests the closest product for a typo", async () => {
    const suggestions = await suggestBeforeAdding("קלה", products);
    expect(suggestions[0]?.productId).toBe("cola");
  });

  it("never suggests a chain-exclusive product", async () => {
    const suggestions = await suggestBeforeAdding("קפה בריסטא", products);
    expect(suggestions.map((s) => s.productId)).not.toContain("barista");
  });

  it("adds text nothing resembles without asking", async () => {
    expect(await suggestBeforeAdding("זזזז", products)).toEqual([]);
  });
});
