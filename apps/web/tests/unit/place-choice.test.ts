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

  it("doesn't ask when the line names one product exactly, pack word and all", () => {
    // Six-packs stand elsewhere than single bottles, and also answer to "קולה".
    const cola = productByName("קוקה קולה 1.5 ליטר");
    const sixPack: Product = {
      ...cola,
      id: "six-pack",
      canonicalName: "שישיית קולה",
      aliases: ["שישיית קולה", "קולה"],
      normalizedAliases: ["שישיית קולה", "קולה"].map(normalizeHebrewText),
    };
    const products = [...demoProducts, sixPack];
    const listings: ProductListing[] = [...demoProductListings, { id: "l-six", productId: sixPack.id, storeId: STORE_ID, nodeId: "n-produce" }];
    expect(placeCandidates(item("1", "שישיית קולה", sixPack.id), STORE_ID, listings, products)).toEqual([sixPack.id]);
    expect(placeCandidates(item("2", "קולה", cola.id), STORE_ID, listings, products)).toEqual([cola.id, sixPack.id]);
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

describe("place choice with products imported from a price file", () => {
  const yogurt = productByName("יוגורט טבעי"); // alias "יוגורט", at n-dairy
  const yellowCheese = productByName("גבינה צהובה פרוסה");
  const imported = (id: string, name: string, aliases: string[], itemKey: string): Product => ({
    ...yogurt,
    id,
    canonicalName: name,
    aliases,
    normalizedAliases: [name, ...aliases].map(normalizeHebrewText),
    sourceItemKey: itemKey,
    shelfGroup: "yogurt",
  });
  const bio = imported("sku-bio", "יוגורט ביו 3% תנובה", ["יוגורט", "יוגורט ביו"], "729-bio");
  const goat = imported("sku-goat", "יוגורט עיזים 3%", ["יוגורט", "יוגורט עיזים"], "729-goat");
  const at = (product: Product, nodeId: string): ProductListing => ({ id: `l-${product.id}`, productId: product.id, storeId: STORE_ID, nodeId });

  it("doesn't ask when every product answering the line stands at one place", () => {
    const products = [...demoProducts, bio, goat];
    const listings = [...demoProductListings, at(bio, "n-dairy"), at(goat, "n-dairy")];
    const line = item("1", "יוגורט", yogurt.id);
    expect(placeCandidates(line, STORE_ID, listings, products)).toHaveLength(3);
    expect(placeQuestions([line], STORE_ID, listings, products)).toEqual([]);
    const { chosen, flexible } = placeDecisions([line], STORE_ID, listings, products);
    expect(chosen.get("1")).toBe(yogurt.id);
    expect(flexible.size).toBe(0);
  });

  it("asks with one option per place, the classified product standing for its own", () => {
    const products = [...demoProducts, bio, goat];
    const listings = [...demoProductListings, at(bio, "n-dairy"), at(goat, "n-produce")];
    const [question] = placeQuestions([item("1", "יוגורט", yogurt.id)], STORE_ID, listings, products);
    expect(question.options.map((o) => [o.nodeId, o.productId, o.productIds.length])).toEqual([
      ["n-dairy", yogurt.id, 2],
      ["n-produce", goat.id, 1],
    ]);
    expect(question.productIds).toEqual([yogurt.id, goat.id]);
    expect(placeDecisions([item("1", "יוגורט", yogurt.id)], STORE_ID, listings, products).flexible.get("1")).toEqual([yogurt.id, goat.id]);
  });

  it("finds imported products through the generic product's linked barcodes", () => {
    const emek = imported("sku-emek", "גבינה עמק 28%", ["עמק"], "729-emek");
    const products = [...demoProducts, emek];
    // The generic yellow cheese isn't placed here; the store's own cheese is.
    const listings = [...demoProductListings.filter((l) => l.productId !== yellowCheese.id), at(emek, "n-dairy")];
    const line = item("1", "גבינה צהובה", yellowCheese.id);
    expect(placeCandidates(line, STORE_ID, listings, products)).toEqual([]);
    const linked = new Map([[yellowCheese.id, new Set(["729-emek"])]]);
    expect(placeCandidates(line, STORE_ID, listings, products, linked)).toEqual([emek.id]);
    expect(placeDecisions([line], STORE_ID, listings, products, undefined, linked).chosen.get("1")).toBe(emek.id);
  });

  it("goes straight to the product of a barcode picked in the cheapest basket", () => {
    const products = [...demoProducts, bio, goat];
    const listings = [...demoProductListings, at(bio, "n-dairy"), at(goat, "n-produce")];
    const line = item("1", "יוגורט", yogurt.id, {
      variant: { kind: "sku", productId: yogurt.id, itemKey: "729-goat", chosenAt: "x" },
    });
    expect(placeQuestions([line], STORE_ID, listings, products)).toEqual([]);
    expect(placeDecisions([line], STORE_ID, listings, products).chosen.get("1")).toBe(goat.id);
  });
});
