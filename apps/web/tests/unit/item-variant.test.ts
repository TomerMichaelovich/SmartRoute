import { describe, expect, it } from "vitest";
import { effectiveVariant } from "@smartroute/core/application/basket/effective-variant";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { shoppingListItemSchema, shoppingListSchema } from "@/src/infrastructure/repositories/schemas";

const milk: ShoppingListItem = {
  id: "i1",
  rawText: "חלב",
  classification: { rawText: "חלב", matchedProductId: "prod-12", confidence: 1, source: "dictionary" },
  variant: {
    kind: "sku",
    productId: "prod-12",
    itemKey: "7290004131074",
    name: "חלב בקרטון 3% שומן 1 ל",
    chosenAt: "2026-10-22T08:00:00.000Z",
  },
};

describe("variant persistence", () => {
  it("survives the item schema used by every list read and save", () => {
    expect(shoppingListItemSchema.parse(milk).variant).toEqual(milk.variant);
  });

  it("survives a full list parse (repository reads)", () => {
    const list = shoppingListSchema.parse({
      id: "l1",
      storeId: "s1",
      items: [milk],
      shareCode: "ABC123",
      createdAt: "2026-10-22T08:00:00.000Z",
      updatedAt: "2026-10-22T08:00:00.000Z",
    });
    expect(list.items[0].variant?.itemKey).toBe("7290004131074");
  });

  it("rejects malformed variants", () => {
    expect(shoppingListItemSchema.safeParse({ ...milk, variant: { kind: "brand", chosenAt: "x" } }).success).toBe(false);
  });
});

describe("effectiveVariant", () => {
  it("returns the choice while the item is still classified as the same product", () => {
    expect(effectiveVariant(milk)).toEqual(milk.variant);
  });

  it("ignores a choice made for another product (item edited or reclassified)", () => {
    const soyMilk = { ...milk, classification: { ...milk.classification!, matchedProductId: "cat-soy" } };
    expect(effectiveVariant(soyMilk)).toBeNull();
  });

  it("ignores an sku choice without an item key", () => {
    expect(effectiveVariant({ ...milk, variant: { kind: "sku", productId: "prod-12", chosenAt: "x" } })).toBeNull();
  });

  it("supports 'any, cheapest' and unclassified items", () => {
    const any = { ...milk, variant: { kind: "any" as const, productId: "prod-12", chosenAt: "x" } };
    expect(effectiveVariant(any)?.kind).toBe("any");
    const unclassified: ShoppingListItem = { id: "i2", rawText: "משהו", variant: { kind: "any", chosenAt: "x" } };
    expect(effectiveVariant(unclassified)?.kind).toBe("any");
  });

  it("returns null when nothing was chosen", () => {
    expect(effectiveVariant({ id: "i3", rawText: "לחם" })).toBeNull();
  });
});
