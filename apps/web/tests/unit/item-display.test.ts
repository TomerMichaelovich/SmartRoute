import { describe, expect, it } from "vitest";
import { itemDisplay } from "@smartroute/core/application/shopping-list/item-display";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { demoProducts } from "@/tests/fixtures/demo-store.fixture";

const coffee = demoProducts.find((p) => p.canonicalName === "קפה נמס")!;
const base: ShoppingListItem = {
  id: "1",
  rawText: "קפה נמס",
  classification: { rawText: "קפה נמס", matchedProductId: coffee.id, confidence: 1, source: "dictionary" },
};

describe("itemDisplay", () => {
  it("shows the line as typed, with nothing under it when nothing was chosen", () => {
    expect(itemDisplay(base, demoProducts)).toEqual({ name: "קפה נמס", chosen: null });
  });

  it("puts the barcode picked in the cheapest-basket popup under it", () => {
    const item = { ...base, variant: { kind: "sku" as const, productId: coffee.id, itemKey: "7290119672134", name: "קפה מגורען גולד בארי", chosenAt: "x" } };
    expect(itemDisplay(item, demoProducts)).toEqual({ name: "קפה נמס", chosen: "קפה מגורען גולד בארי" });
  });

  it("else the product picked in a store, unless it's just the typed name", () => {
    const tahini = demoProducts.find((p) => p.canonicalName === "טחינה גולמית")!;
    const item: ShoppingListItem = { id: "2", rawText: "טחינה", placeChoice: { productId: tahini.id, text: "טחינה", chosenAt: "x" } };
    expect(itemDisplay(item, demoProducts)).toEqual({ name: "טחינה", chosen: "טחינה גולמית" });
    const same: ShoppingListItem = { id: "3", rawText: "טחינה גולמית", placeChoice: { productId: tahini.id, text: "טחינה גולמית", chosenAt: "x" } };
    expect(itemDisplay(same, demoProducts).chosen).toBeNull();
  });
});
