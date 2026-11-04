import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { SHELF_GROUPS, NOT_A_PRODUCT_GROUP } from "@smartroute/core/domain/value-objects/shelf-group";
import {
  type BranchItem,
  type EnrichedItem,
  buildImportedProduct,
  importedProductId,
  planCatalogSync,
  validateEnrichment,
} from "@/src/infrastructure/catalog/catalog-import";

const CHAIN = { navioChainId: "רמי לוי", brandName: "רמי לוי" };

function branchItem(itemKey: string, name = "פריט"): BranchItem {
  return { itemKey, name, manufacturer: null, quantity: null, unitQty: null, isWeighted: false };
}

const milk: EnrichedItem = {
  itemKey: "7290004131074",
  name: "חלב טרי 3% תנובה 1 ליטר",
  aliases: ["חלב", "חלב 3%", "חלב תנובה"],
  group: "fresh-milk",
};

describe("shelf groups", () => {
  it("have unique ids", () => {
    const ids = SHELF_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("importedProductId", () => {
  it("is one stable id per barcode, whichever chain's file it came from", () => {
    expect(importedProductId("123")).toBe(importedProductId("123"));
    expect(importedProductId("123")).not.toBe(importedProductId("124"));
    expect(importedProductId("rami-levy:123")).not.toBe(importedProductId("shufersal:123"));
    expect(importedProductId("123")).toMatch(/^sku-[0-9a-f]{16}$/);
  });
});

describe("validateEnrichment", () => {
  const input = [branchItem(milk.itemKey, "חלב טרי 3% 1 ל תנובה"), branchItem("2", "דמי משלוח")];
  const fee: EnrichedItem = { itemKey: "2", name: "דמי משלוח", aliases: [], group: NOT_A_PRODUCT_GROUP };

  it("accepts a complete chunk and cleans aliases", () => {
    const { items, errors } = validateEnrichment(input, [
      { ...milk, aliases: [" חלב ", "חלב", "חלב טרי 3% תנובה 1 ליטר", "חלב 3%", "חלב תנובה"] },
      fee,
    ]);
    expect(errors).toEqual([]);
    expect(items[0].aliases).toEqual(["חלב", "חלב 3%", "חלב תנובה"]);
    expect(items[1].aliases).toEqual([]);
  });

  it("reports missing, extra and duplicate items", () => {
    const { errors } = validateEnrichment(input, [milk, milk, { ...milk, itemKey: "999" }]);
    expect(errors).toContain(`${milk.itemKey}: appears twice`);
    expect(errors).toContain("999: not in this chunk");
    expect(errors).toContain("2: missing from output");
  });

  it("rejects an unknown group, an empty name, no aliases and a non-array", () => {
    const { items, errors } = validateEnrichment(input, [{ ...milk, name: " ", group: "milk", aliases: [] }, fee]);
    expect(items.map((i) => i.itemKey)).toEqual(["2"]);
    expect(errors[0]).toContain("empty name");
    expect(errors[0]).toContain('unknown group "milk"');
    expect(errors[0]).toContain("no aliases");
    expect(validateEnrichment(input, { items: [] }).errors).toEqual(["output is not a JSON array"]);
  });
});

describe("buildImportedProduct", () => {
  it("takes department and category from the group and indexes name + aliases", () => {
    const product = buildImportedProduct(CHAIN, milk);
    expect(product).toMatchObject({
      id: importedProductId(milk.itemKey),
      chainId: null,
      sourceItemKey: milk.itemKey,
      shelfGroup: "fresh-milk",
      department: "מוצרי חלב",
      category: "dairy",
      isActive: true,
      manuallyEdited: false,
    });
    expect(product.normalizedAliases).toEqual([milk.name, ...milk.aliases].map(normalizeHebrewText));
  });

  it("ties only the chain's own label to the chain", () => {
    const paprika: EnrichedItem = { itemKey: "p", name: "פפריקה מתוקה רמי לוי 100 גרם", aliases: ["פפריקה"], group: "spices" };
    expect(buildImportedProduct(CHAIN, paprika).chainId).toBe("רמי לוי");
  });
});

describe("planCatalogSync", () => {
  const id = (key: string) => importedProductId(key);
  const none = new Set<string>();
  const enriched = (...items: EnrichedItem[]) => new Map(items.map((i) => [i.itemKey, i]));
  const bread: EnrichedItem = { itemKey: "b", name: "לחם אחיד", aliases: ["לחם"], group: "packaged-bread" };

  it("upserts enriched items and lists the ones still to enrich", () => {
    const plan = planCatalogSync(CHAIN, [], [milk.itemKey, "new"], enriched(milk), none);
    expect(plan.upsert.map((p) => p.id)).toEqual([id(milk.itemKey)]);
    expect(plan.notEnriched).toEqual(["new"]);
  });

  it("deactivates only what no price file carries and never touches an admin's edit", () => {
    const existing = [
      { id: id("gone"), sourceItemKey: "gone", isActive: true, manuallyEdited: false },
      { id: id("elsewhere"), sourceItemKey: "elsewhere", isActive: true, manuallyEdited: false },
      { id: id("b"), sourceItemKey: "b", isActive: false, manuallyEdited: true },
    ];
    const plan = planCatalogSync(CHAIN, existing, ["b"], enriched(bread), new Set(["b", "elsewhere"]));
    expect(plan.deactivate).toEqual([id("gone")]);
    expect(plan.reactivate).toEqual([id("b")]);
    expect(plan.upsert).toEqual([]);
  });

  it("skips non-products and deactivates them if they were imported", () => {
    const fee: EnrichedItem = { itemKey: "fee", name: "דמי משלוח", aliases: [], group: NOT_A_PRODUCT_GROUP };
    const existing = [{ id: id("fee"), sourceItemKey: "fee", isActive: true, manuallyEdited: false }];
    const plan = planCatalogSync(CHAIN, existing, ["fee"], enriched(fee), none);
    expect(plan.upsert).toEqual([]);
    expect(plan.deactivate).toEqual([id("fee")]);
  });
});
