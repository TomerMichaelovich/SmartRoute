import { describe, expect, it } from "vitest";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import { STORE_ID, demoProducts } from "@/tests/fixtures/demo-store.fixture";

const generic = demoProducts.find((p) => p.canonicalName === "קפה נמס")!;
const barista: Product = {
  ...generic,
  id: "barista",
  canonicalName: "קפה נמס בריסטה",
  aliases: ["קפה נמס"],
  normalizedAliases: ["קפה נמס בריסטה", "קפה נמס"],
};
// The store carries only the Barista product.
const listings: ProductListing[] = [{ id: "l1", productId: barista.id, storeId: STORE_ID, nodeId: "n-pantry" }];
const result = { rawText: "קפה נמס", matchedProductId: generic.id, confidence: 1, source: "dictionary" as const };

describe("resolveAvailability", () => {
  it("routing: switches to the same-name product the store carries", () => {
    expect(resolveAvailability(result, STORE_ID, listings, [...demoProducts, barista]).matchedProductId).toBe(barista.id);
  });

  it("list lines: keeps what was typed, only flags it as not carried there", () => {
    const resolved = resolveAvailability(result, STORE_ID, listings, [...demoProducts, barista], { switchToCarried: false });
    expect(resolved.matchedProductId).toBe(generic.id);
    expect(resolved.availableAtStore).toBe(false);
  });
});
