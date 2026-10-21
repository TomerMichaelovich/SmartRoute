import { describe, expect, it } from "vitest";
import { normalizeRetailName } from "@/src/infrastructure/prices/ingest";
import { findSkuCandidates, type CandidateItem } from "@/src/infrastructure/prices/sku-candidates";
import { verifySkuCandidatesByRules } from "@/src/infrastructure/prices/sku-rules";

let nextId = 1;
function item(name: string, extra: Partial<CandidateItem> = {}): CandidateItem {
  const id = nextId++;
  return {
    id,
    itemKey: `k${id}`,
    name,
    normalizedName: normalizeRetailName(name),
    manufacturer: null,
    quantity: null,
    unitQty: null,
    isWeighted: false,
    branchCount: 5,
    ...extra,
  };
}

const ITEMS = [
  item("חלב בקרטון 3% שומן 1 ל", { quantity: 1, unitQty: "ליטר", manufacturer: 'תנובה בע"מ' }),
  item("חלב 3% מהדרין 2ל תנובה", { quantity: 2, unitQty: "ליטר" }),
  item("חלב מפוסטר 1% בקרטון 1ל", { quantity: 1, unitQty: "ליטר" }),
  item("חלב נטו.לקטוז מועשר2% 1ל", { quantity: 1, unitQty: "ליטר" }),
  item("שוקולד חלב אגוזי לוז100ג"),
  item("חלבה וניל 500 גרם"),
  item("משקה חלב בטעם שוקו"),
  item("עגבניה", { isWeighted: true, branchCount: 10 }),
  item("עגבניות מרוסקות800ג יכין", { branchCount: 20 }),
  item("עגבניות קצוצות דק 3*400ג", { branchCount: 15 }),
  item("עגבניות שרי בודד", { branchCount: 8 }),
];

const names = (keys: string[]) => keys.map((k) => ITEMS.find((i) => i.itemKey === k)!.name);

describe("findSkuCandidates", () => {
  it("matches whole words only, so חלבה is never milk", () => {
    const found = names(findSkuCandidates(["חלב"], ITEMS).map((c) => c.itemKey));
    expect(found).toContain("חלב בקרטון 3% שומן 1 ל");
    expect(found).toContain("שוקולד חלב אגוזי לוז100ג"); // whole word, not at start — verification rejects it
    expect(found).not.toContain("חלבה וניל 500 גרם");
  });

  it("matches multi-word aliases in any order, with synonyms (ללא ~ נטול)", () => {
    const candidates = findSkuCandidates(["חלב ללא לקטוז"], ITEMS);
    expect(names(candidates.filter((c) => !c.viaFallback).map((c) => c.itemKey))).toEqual(["חלב נטו.לקטוז מועשר2% 1ל"]);
    // Too few full matches: other milks come in through the head word, flagged so verification rejects them.
    expect(candidates.filter((c) => c.viaFallback).length).toBeGreaterThan(0);
  });

  it("ranks the plain short name above more popular processed ones", () => {
    expect(findSkuCandidates(["עגבניות"], ITEMS)[0].name).toBe("עגבניה");
  });
});

describe("verifySkuCandidatesByRules", () => {
  const verdictsFor = (canonicalName: string, aliases: string[], department: string) => {
    const candidates = findSkuCandidates(aliases, ITEMS);
    const v = verifySkuCandidatesByRules({ canonicalName, normalizedAliases: aliases, department }, candidates);
    return {
      matched: names(v.filter((x) => x.match).map((x) => x.itemKey)),
      typical: names(v.filter((x) => x.typical).map((x) => x.itemKey)),
      label: (name: string) => v.find((x) => x.itemKey === ITEMS.find((i) => i.name === name)!.itemKey)!.label,
    };
  };

  it("rejects products that only contain the word, keeps variants of the same product", () => {
    const { matched } = verdictsFor("חלב 3% תנובה 1 ליטר", ["חלב 3% תנובה 1 ליטר", "חלב"], "מוצרי חלב");
    expect(matched).toContain("חלב 3% מהדרין 2ל תנובה");
    expect(matched).toContain("חלב מפוסטר 1% בקרטון 1ל");
    expect(matched).not.toContain("שוקולד חלב אגוזי לוז100ג");
    expect(matched).not.toContain("משקה חלב בטעם שוקו");
  });

  it("typical = same fat % and size as the canonical name, any brand", () => {
    const { typical } = verdictsFor("חלב 3% תנובה 1 ליטר", ["חלב 3% תנובה 1 ליטר", "חלב"], "מוצרי חלב");
    expect(typical).toEqual(["חלב בקרטון 3% שומן 1 ל"]);
  });

  it("labels drop only the generic term and keep the distinguishing numbers", () => {
    const { label } = verdictsFor("חלב 3% תנובה 1 ליטר", ["חלב 3% תנובה 1 ליטר", "חלב"], "מוצרי חלב");
    expect(label("חלב בקרטון 3% שומן 1 ל")).toBe("בקרטון 3% שומן 1 ל · תנובה");
  });

  it("fresh produce: rejects preserves, and the typical pick is sold by weight", () => {
    const { matched, typical } = verdictsFor("עגבניות", ["עגבניות", "עגבניה"], "ירקות ופירות");
    expect(matched).not.toContain("עגבניות מרוסקות800ג יכין");
    expect(matched).not.toContain("עגבניות קצוצות דק 3*400ג");
    expect(matched).toContain("עגבניות שרי בודד");
    expect(typical).toEqual(["עגבניה"]);
  });
});
