import { describe, expect, it } from "vitest";
import { computeBasketQuotes, type PricedLine } from "@smartroute/core/application/basket/compute-basket-quotes";
import { needsVariantChoice } from "@smartroute/core/application/basket/needs-variant-choice";

const branch = (id: number, distanceKm: number | null = null) => ({ id, distanceKm });
const line = (priceAgorot: number): PricedLine => ({ itemKey: `k${priceAgorot}`, name: "x", priceAgorot });
const req = (itemId: string, quantity = 1, estimated = false) => ({ itemId, rawText: itemId, quantity, estimated });

function prices(table: Record<number, Record<string, number>>) {
  return new Map(
    Object.entries(table).map(([b, items]) => [
      Number(b),
      new Map(Object.entries(items).map(([item, p]) => [item, line(p)])),
    ]),
  );
}

describe("computeBasketQuotes", () => {
  it("ranks by basket total and multiplies by quantity", () => {
    const { quotes } = computeBasketQuotes({
      requirements: [req("milk", 2), req("bread")],
      branches: [branch(1), branch(2)],
      prices: prices({ 1: { milk: 700, bread: 800 }, 2: { milk: 650, bread: 900 } }),
      limit: 3,
    });
    expect(quotes.map((q) => [q.branch.id, q.totalAgorot])).toEqual([
      [1, 2200],
      [2, 2200],
    ]);
    expect(quotes[0].lines.find((l) => l.itemId === "milk")!.lineTotalAgorot).toBe(1400);
  });

  it("charges missing items at the median, so a branch can't win by lacking them", () => {
    const { quotes } = computeBasketQuotes({
      requirements: [req("milk"), req("salmon")],
      branches: [branch(1), branch(2), branch(3)],
      // Branch 3 has no salmon: its shown total is lowest, but salmon costs 6000 elsewhere.
      prices: prices({ 1: { milk: 700, salmon: 6000 }, 2: { milk: 690, salmon: 6200 }, 3: { milk: 600 } }),
      limit: 3,
    });
    expect(quotes[0].branch.id).toBe(1);
    const third = quotes.find((q) => q.branch.id === 3)!;
    expect(third.totalAgorot).toBe(600);
    // The full basket charges the missing salmon at its median elsewhere (6000 / 6200 -> 6100).
    expect(third.fullBasketAgorot).toBe(6700);
    expect(third.missingItems).toEqual([{ itemId: "salmon", rawText: "salmon", estimatedAgorot: 6100 }]);
    // Ranked by the full basket: ascending all the way down.
    const full = quotes.map((q) => q.fullBasketAgorot);
    expect(full).toEqual([...full].sort((a, b) => a - b));
  });

  it("an item no branch sells is reported once and counted against nobody", () => {
    const { quotes, unavailableEverywhere } = computeBasketQuotes({
      requirements: [req("milk"), req("unicorn")],
      branches: [branch(1), branch(2)],
      prices: prices({ 1: { milk: 700 }, 2: { milk: 650 } }),
      limit: 3,
    });
    expect(unavailableEverywhere).toEqual([{ itemId: "unicorn", rawText: "unicorn" }]);
    expect(quotes.every((q) => q.missingItems.length === 0)).toBe(true);
    expect(quotes[0].branch.id).toBe(2);
  });

  it("breaks ties by fewer missing items, then distance", () => {
    const { quotes } = computeBasketQuotes({
      requirements: [req("milk")],
      branches: [branch(1, 3.2), branch(2, 0.8)],
      prices: prices({ 1: { milk: 700 }, 2: { milk: 700 } }),
      limit: 3,
    });
    expect(quotes.map((q) => q.branch.id)).toEqual([2, 1]);
  });

  it("flags estimated totals and respects the limit", () => {
    const { quotes } = computeBasketQuotes({
      requirements: [req("tomatoes", 1, true)],
      branches: [branch(1), branch(2), branch(3), branch(4)],
      prices: prices({ 1: { tomatoes: 490 }, 2: { tomatoes: 590 }, 3: { tomatoes: 690 }, 4: { tomatoes: 390 } }),
      limit: 3,
    });
    expect(quotes).toHaveLength(3);
    expect(quotes[0]).toMatchObject({ branch: { id: 4 }, estimated: true });
  });
});

describe("needsVariantChoice", () => {
  const item = { id: "i", rawText: "חלב", classification: { rawText: "חלב", matchedProductId: "p", confidence: 1, source: "dictionary" as const } };
  const pkg = { isWeighted: false, isTypical: true };

  it("asks when there are several packaged options and no choice yet", () => {
    expect(needsVariantChoice(item, [pkg, { ...pkg, isTypical: false }])).toBe(true);
  });

  it("doesn't ask with fewer than two options", () => {
    expect(needsVariantChoice(item, [pkg])).toBe(false);
  });

  it("doesn't ask for weighted produce", () => {
    expect(needsVariantChoice(item, [{ isWeighted: true, isTypical: true }, pkg])).toBe(false);
  });

  it("doesn't ask again once chosen", () => {
    const chosen = { ...item, variant: { kind: "any" as const, productId: "p", chosenAt: "x" } };
    expect(needsVariantChoice(chosen, [pkg, pkg])).toBe(false);
  });
});
