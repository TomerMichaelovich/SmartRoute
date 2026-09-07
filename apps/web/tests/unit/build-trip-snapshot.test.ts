import { describe, expect, it } from "vitest";
import { buildTripItems } from "@smartroute/core/application/shopping-list/build-trip-snapshot";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";

const items: ShoppingListItem[] = [
  { id: "a", rawText: "חלב", quantity: 2, classification: { rawText: "חלב", matchedProductId: "p-milk", confidence: 1, source: "dictionary" } },
  { id: "b", rawText: "לחם", classification: { rawText: "לחם", matchedProductId: "p-bread", confidence: 1, source: "dictionary" } },
  { id: "c", rawText: "משהו מוזר", classification: { rawText: "משהו מוזר", confidence: 0, source: "unresolved" } },
];
const names = new Map([["p-milk", "חלב 3% תנובה"], ["p-bread", "לחם אחיד"]]);

describe("buildTripItems", () => {
  it("marks collected and not-found from the given id sets", () => {
    const out = buildTripItems(items, names, new Set(["a"]), new Set(["b"]));
    expect(out[0]).toMatchObject({ collected: true, notFound: false, quantity: 2 });
    expect(out[1]).toMatchObject({ collected: false, notFound: true });
    expect(out[2]).toMatchObject({ collected: false, notFound: false });
  });

  it("resolves productName from the matched product id, null when unmatched", () => {
    const out = buildTripItems(items, names, new Set(), new Set());
    expect(out[0].productName).toBe("חלב 3% תנובה");
    expect(out[2].productName).toBeNull();
  });

  it("keeps productName null when the matched id isn't in the name map", () => {
    const out = buildTripItems(items, new Map(), new Set(), new Set());
    expect(out[0].productName).toBeNull();
  });

  it("preserves the raw text verbatim (snapshot is a copy)", () => {
    const out = buildTripItems(items, names, new Set(), new Set());
    expect(out.map((i) => i.rawText)).toEqual(["חלב", "לחם", "משהו מוזר"]);
  });
});
