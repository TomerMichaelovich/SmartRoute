import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { type PlaceProximity, placeCandidates, placeDecisions, placeProximity, placeQuestions } from "@smartroute/core/application/routing/place-choice";
import { buildRoute, choosePlaces } from "@smartroute/core/application/routing/route-service";
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

  it("finds imported products by the alias classification corrected a typo to", () => {
    const gin = imported("sku-gin", "בומביי ג'ין 1 ליטר", ["ג'ין", "בומביי"], "729-gin");
    const products = [...demoProducts, gin];
    const listings = [...demoProductListings, at(gin, "n-beverages")];
    const line: ShoppingListItem = {
      id: "1",
      rawText: "בומבאי",
      classification: { rawText: "בומבאי", matchedAlias: "בומביי", confidence: 0.7, source: "fuzzy" },
    };
    expect(placeCandidates(line, STORE_ID, listings, products)).toEqual([gin.id]);
    expect(placeDecisions([line], STORE_ID, listings, products).chosen.get("1")).toBe(gin.id);
  });

  describe("with the store's walking distances", () => {
    const spread = { ...imported("sku-spread", "חומוס אחלה 400 גרם", ["חומוס"], "729-spread"), shelfGroup: "chilled-salads-dips" };
    const spread2 = { ...imported("sku-spread2", "חומוס צבר 400 גרם", ["חומוס"], "729-spread2"), shelfGroup: "chilled-salads-dips" };
    const canned = { ...imported("sku-canned", "גרגירי חומוס 800 גרם", ["חומוס"], "729-canned"), shelfGroup: "canned-legumes" };
    const line: ShoppingListItem = { id: "1", rawText: "חומוס", classification: { rawText: "חומוס", matchedAlias: "חומוס", confidence: 1, source: "alias" } };
    const apart: PlaceProximity = { distance: (a, b) => (a === b ? 0 : 500), near: 100 };
    const adjacent: PlaceProximity = { distance: (a, b) => (a === b ? 0 : 50), near: 100 };
    const ask = (placed: ProductListing[], proximity: PlaceProximity) =>
      placeQuestions([line], STORE_ID, [...demoProductListings, ...placed], [...demoProducts, spread, spread2, canned], undefined, undefined, proximity);

    it("doesn't ask about different products standing next to each other", () => {
      expect(ask([at(spread, "n-dairy"), at(canned, "n-produce")], adjacent)).toEqual([]);
    });

    it("doesn't ask about one kind of product in places apart", () => {
      expect(ask([at(spread, "n-dairy"), at(spread2, "n-produce")], apart)).toEqual([]);
    });

    it("asks about different products apart, one option per kind", () => {
      const [question] = ask([at(spread, "n-dairy"), at(spread2, "n-beverages"), at(canned, "n-produce")], apart);
      expect(question.options).toHaveLength(2);
      expect(question.options.map((o) => o.productIds.length).sort()).toEqual([1, 2]);
    });

    it("measures on foot, the shorter way round", () => {
      const proximity = placeProximity(demoNodes, demoEdges, demoStore.mapWidth, demoStore.mapHeight);
      expect(proximity.distance("n-produce", "n-bakery")).toBe(proximity.distance("n-bakery", "n-produce"));
      expect(proximity.distance("n-produce", "n-produce")).toBe(0);
    });

    it("treats departments marked as one shelf as the same spot, however far their points are", () => {
      const plain = placeProximity(demoNodes, demoEdges, demoStore.mapWidth, demoStore.mapHeight);
      expect(plain.distance("n-produce", "n-meat-fish")).toBeGreaterThan(plain.near);
      const marked = demoNodes.map((n) => (n.id === "n-produce" || n.id === "n-meat-fish" ? { ...n, shelfId: "shelf-1" } : n));
      const proximity = placeProximity(marked, demoEdges, demoStore.mapWidth, demoStore.mapHeight);
      expect(proximity.distance("n-produce", "n-meat-fish")).toBe(0);
      expect(proximity.distance("n-produce", "n-dairy")).toBe(plain.distance("n-produce", "n-dairy"));
      expect(ask([at(spread, "n-produce"), at(canned, "n-meat-fish")], proximity)).toEqual([]);
    });

    it("marks the other places on the stop the route takes", () => {
      const products = [...demoProducts, spread, canned];
      const listings = [...demoProductListings, at(spread, "n-dairy"), at(canned, "n-produce")];
      const pinned = { ...line, classification: { ...line.classification!, matchedProductId: spread.id } };
      const route = buildRoute({
        routeId: "r",
        storeId: STORE_ID,
        shoppingListId: "l",
        items: [pinned],
        listings,
        nodes: demoNodes,
        edges: demoEdges,
        mapWidth: demoStore.mapWidth,
        mapHeight: demoStore.mapHeight,
        alternativePlaces: new Map([
          [
            "1",
            [
              { nodeId: "n-dairy", productId: spread.id },
              { nodeId: "n-produce", productId: canned.id, label: "שימורים" },
            ],
          ],
        ]),
      });
      expect(route.stops[0].nodeId).toBe("n-dairy");
      expect(route.stops[0].alsoAt).toEqual([
        { itemId: "1", nodeIds: ["n-produce"], places: [{ nodeId: "n-produce", productId: canned.id, label: "שימורים" }] },
      ]);
    });
  });

  describe("a kind tapped while typing the line", () => {
    const drink = (id: string, name: string): Product => ({
      ...imported(id, name, ["קולה"], `729-${id}`),
      shelfGroup: "soft-drinks",
    });
    const bottle = drink("bottle", "קוקה קולה בקבוק 1.5 ליטר");
    const can = drink("can", "קוקה קולה בפחית 330 מ\"ל");
    const six = drink("six", "קוקה קולה שישייה 1.5 ליטר");
    const products = [...demoProducts, bottle, can, six];
    const listings = [...demoProductListings, at(bottle, "n-beverages"), at(can, "n-beverages"), at(six, "n-produce")];
    const line = (kindChoice?: ShoppingListItem["kindChoice"], rawText = "קולה"): ShoppingListItem => ({
      id: "1",
      rawText,
      classification: { rawText, matchedAlias: "קולה", confidence: 1, source: "alias" },
      ...(kindChoice ? { kindChoice } : {}),
    });
    const sixPack = { groups: ["soft-drinks"], form: "sixpack" as const, label: "שישייה", text: "קולה", chosenAt: "x" };

    it("takes the route straight to that kind", () => {
      expect(placeCandidates(line(sixPack), STORE_ID, listings, products)).toEqual([six.id]);
      const { chosen, flexible } = placeDecisions([line(sixPack)], STORE_ID, listings, products);
      expect(chosen.get("1")).toBe(six.id);
      expect(flexible.size).toBe(0);
    });

    it("no longer applies once the line is edited", () => {
      expect(placeCandidates(line(sixPack, "קולה זירו"), STORE_ID, listings, products)).not.toEqual([six.id]);
    });

    it("falls back to what the store has when it doesn't carry that kind", () => {
      const noSix = listings.filter((l) => l.productId !== six.id);
      const candidates = placeCandidates(line(sixPack), STORE_ID, noSix, products);
      expect(candidates).toEqual(expect.arrayContaining([bottle.id, can.id]));
      expect(candidates).not.toContain(six.id);
    });

    it("names the other places by what sets them apart", () => {
      const { alternatives } = placeDecisions([line()], STORE_ID, listings, products);
      expect(alternatives.get("1")?.find((p) => p.nodeId === "n-produce")?.label).toBe("שישיות");
    });

    it("keeps a way back after going to one of the places, within the same kind of product", () => {
      const picked = line();
      picked.placeChoice = { productId: six.id, text: "קולה", chosenAt: "x" };
      const { chosen, alternatives } = placeDecisions([picked], STORE_ID, listings, products);
      expect(chosen.get("1")).toBe(six.id);
      expect(alternatives.get("1")?.map((p) => p.nodeId).sort()).toEqual(["n-beverages", "n-produce"]);
    });
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
