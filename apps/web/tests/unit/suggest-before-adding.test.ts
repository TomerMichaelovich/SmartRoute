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

  it("adds a line the stores carry under that name without asking", async () => {
    const asked: string[] = [];
    const known = async (text: string) => (asked.push(text), true);
    expect(await suggestBeforeAdding("קלה", products, known)).toEqual([]);
    // A confident match never needs the server.
    expect(await suggestBeforeAdding("קולה", products, known)).toEqual([]);
    expect(asked).toEqual(["קלה"]);
  });

  it("still suggests when the server can't be asked", async () => {
    const offline = async () => Promise.reject(new Error("offline"));
    expect((await suggestBeforeAdding("קלה", products, offline))[0]?.productId).toBe("cola");
  });

  it("adds text nothing resembles without asking", async () => {
    expect(await suggestBeforeAdding("זזזז", products)).toEqual([]);
  });
});
