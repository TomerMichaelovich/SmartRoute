import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { placeCandidates, placeDecisions, placeQuestions } from "@smartroute/core/application/routing/place-choice";
import { choosePlaces } from "@smartroute/core/application/routing/route-service";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { STORE_ID, demoEdges, demoNodes, demoProductListings, demoProducts, demoStore } from "@/tests/fixtures/demo-store.fixture";

function productByName(name: string): Product {
  const product = demoProducts.find((p) => p.canonicalName === name);
  if (!product) throw new Error(`Fixture missing expected product: ${name}`);
  return product;
}

const generic = productByName("טחינה גולמית"); // alias "טחינה", at n-pantry
const chainTahini: Product = {
  ...generic,
  id: "chain-tahini",
  canonicalName: "טחינה גולמית רמי לוי",
  aliases: ["טחינה"],
  normalizedAliases: ["טחינה גולמית רמי לוי", "טחינה"].map(normalizeHebrewText),
  chainId: "rami-levy",
};

function withChainTahiniAt(nodeId: string) {
  const products = [...demoProducts, chainTahini];
  const listings: ProductListing[] = [...demoProductListings, { id: "l-chain-tahini", productId: chainTahini.id, storeId: STORE_ID, nodeId }];
  return { products, listings };
}

function item(id: string, rawText: string, productId: string, extra: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return { id, rawText, classification: { rawText, matchedProductId: productId, confidence: 1, source: "dictionary" }, ...extra };
}

const choose = (items: ShoppingListItem[], listings: ProductListing[], products: Product[]) =>
  choosePlaces({
    storeId: STORE_ID,
    items,
    flexible: placeDecisions(items, STORE_ID, listings, products).flexible,
    listings,
    nodes: demoNodes,
    edges: demoEdges,
    mapWidth: demoStore.mapWidth,
    mapHeight: demoStore.mapHeight,
  });

describe("place choice", () => {
  it("finds every product the store carries under the item's name, the classified one first", () => {
    const { products, listings } = withChainTahiniAt("n-produce");
    expect(placeCandidates(item("1", "טחינה", generic.id), STORE_ID, listings, products)).toEqual([generic.id, chainTahini.id]);
    expect(placeCandidates(item("1", "2 טחינה", generic.id), STORE_ID, listings, products)).toEqual([generic.id, chainTahini.id]);
  });

  it("has nothing to ask when the store carries only one of them", () => {
    expect(placeQuestions([item("1", "טחינה", generic.id)], STORE_ID, demoProductListings, demoProducts)).toEqual([]);
  });

  it("asks once: a saved pick or 'don't mind' applies until the item is edited", () => {
    const { products, listings } = withChainTahiniAt("n-produce");
    const ask = (i: ShoppingListItem) => placeQuestions([i], STORE_ID, listings, products).length;
    expect(ask(item("1", "טחינה", generic.id))).toBe(1);
    const picked = { productId: chainTahini.id, text: "טחינה", chosenAt: "2026-10-25T00:00:00Z" };
    expect(ask(item("1", "טחינה", generic.id, { placeChoice: picked }))).toBe(0);
    expect(ask(item("1", "טחינה", generic.id, { placeChoice: { ...picked, productId: null } }))).toBe(0);
    expect(ask(item("1", "2 טחינה", generic.id, { placeChoice: picked }))).toBe(1);
    expect(ask(item("1", "טחינה", generic.id, { checked: true }))).toBe(0);
  });

  it("applies a saved pick directly, and leaves the rest to the route", () => {
    const { products, listings } = withChainTahiniAt("n-produce");
    const picked = item("1", "טחינה", generic.id, { placeChoice: { productId: chainTahini.id, text: "טחינה", chosenAt: "x" } });
    const { chosen, flexible } = placeDecisions([picked, item("2", "טחינה", generic.id)], STORE_ID, listings, products);
    expect(chosen.get("1")).toBe(chainTahini.id);
    expect(flexible.get("2")).toEqual([generic.id, chainTahini.id]);
  });

  it("follows a cheapest-basket pick to the most specific product linked to that barcode", () => {
    const { products, listings } = withChainTahiniAt("n-produce");
    // The generic product is linked to every tahini, the chain's only to its own.
    const skuKeys = new Map([
      [generic.id, new Set(["7290-rl-tahini", "7290-other-tahini"])],
      [chainTahini.id, new Set(["7290-rl-tahini"])],
    ]);
    const pick = (itemKey: string) =>
      item("1", "טחינה", generic.id, { variant: { kind: "sku", productId: generic.id, itemKey, chosenAt: "x" } });

    expect(placeQuestions([pick("7290-rl-tahini")], STORE_ID, listings, products, skuKeys)).toEqual([]);
    expect(placeDecisions([pick("7290-rl-tahini")], STORE_ID, listings, products, skuKeys).chosen.get("1")).toBe(chainTahini.id);
    expect(placeDecisions([pick("7290-other-tahini")], STORE_ID, listings, products, skuKeys).chosen.get("1")).toBe(generic.id);
    // A barcode neither is linked to settles nothing: ask.
    expect(placeQuestions([pick("7290-unknown")], STORE_ID, listings, products, skuKeys)).toHaveLength(1);
  });

  it("'don't mind' takes the shelf the route stops at anyway", () => {
    const { products, listings } = withChainTahiniAt("n-dairy");
    const items = [item("1", "טחינה", generic.id), item("2", "גבינה לבנה 5%", productByName("גבינה לבנה 5%").id)];
    expect(choose(items, listings, products).get("1")).toBe(chainTahini.id);
  });

  it("'don't mind' takes the shorter detour otherwise", () => {
    // Produce is the first department past the entrance; pantry is far into the store.
    const { products, listings } = withChainTahiniAt("n-produce");
    expect(choose([item("1", "טחינה", generic.id)], listings, products).get("1")).toBe(chainTahini.id);
    const items = [item("1", "טחינה", generic.id), item("2", "אורז", productByName("אורז").id)];
    expect(choose(items, listings, products).get("1")).toBe(generic.id);
  });
});
