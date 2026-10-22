import { describe, expect, it } from "vitest";
import { dedupeByName, equivalentKeys, scaledFallbacks } from "@/src/infrastructure/prices/sku-equivalence";

// Real egg listings from Be'er Sheva branches (2026-10-22).
const EGGS = [
  { itemKey: "rl-12L", name: "ביצים 12 יח גדול L", manufacturer: null },
  { itemKey: "rl-12L-b", name: "ביצים 12 יח גדול L", manufacturer: null },
  { itemKey: "rl-12M", name: "ביצים 12 יח בינוני M", manufacturer: null },
  { itemKey: "rl-18L", name: "ביצים 18יח גדול L", manufacturer: null },
  { itemKey: "carrefour-12L", name: "ביצים L רגילות 12 יח", manufacturer: "המכון למיון ושיווק ב" },
  { itemKey: "carrefour-18L", name: "ביצים L גדול 18 יחיד", manufacturer: "המכון למיון ושיווק ב" },
  { itemKey: "shufersal-omega", name: "ביצים אומגה 12 יח בי", manufacturer: "מ.לסר" },
  { itemKey: "omega-12L", name: "ביצים אומגה3 12יחידות L", manufacturer: "," },
  { itemKey: "lesser-xl", name: "ביצים ארוזות XL 12יחידות", manufacturer: "מ.לסר" },
];

const COLA = [
  { itemKey: "coke-15", name: "קוקה קולה 1.5 ליטר", manufacturer: "החברה המרכזית" },
  { itemKey: "coke-15-b", name: "קוקה קולה בקבוק 1.5 ל", manufacturer: "החברה המרכזית" },
  { itemKey: "pepsi-15", name: "פפסי קולה 1.5 ליטר", manufacturer: "טמפו" },
  { itemKey: "coke-2", name: "קוקה קולה 2 ליטר", manufacturer: "החברה המרכזית" },
  { itemKey: "coke-6pack", name: "קוקה קולה 6*1.5 ליטר", manufacturer: "החברה המרכזית" },
];

describe("equivalentKeys", () => {
  it("finds the same eggs (count + size class) under other chains' barcodes", () => {
    const keys = equivalentKeys("rl-12L", EGGS);
    expect(keys).toContain("rl-12L-b");
    expect(keys).toContain("carrefour-12L"); // "L רגילות 12 יח" = 12 large
    expect(keys).not.toContain("rl-12M"); // medium
    expect(keys).not.toContain("rl-18L"); // 18, not 12
    expect(keys).not.toContain("shufersal-omega"); // no size class -> not the same pick
    expect(keys).not.toContain("omega-12L"); // omega L isn't plain L
    expect(keys).not.toContain("lesser-xl"); // XL
  });

  it("keeps brand and size apart", () => {
    const keys = equivalentKeys("coke-15", COLA);
    expect(keys).not.toContain("pepsi-15");
    expect(keys).not.toContain("coke-2");
    expect(keys).not.toContain("coke-6pack"); // 6 x 1.5 L is not one 1.5 L bottle
  });

  it("returns nothing for an unknown key", () => {
    expect(equivalentKeys("nope", EGGS)).toEqual([]);
  });
});

describe("scaledFallbacks", () => {
  it("offers the same kind in another pack size, priced per unit at the target size", () => {
    const fallbacks = scaledFallbacks(["rl-12L"], EGGS);
    const tray18 = fallbacks.find((f) => f.itemKey === "rl-18L");
    expect(tray18?.factor).toBeCloseTo(12 / 18);
    expect(fallbacks.find((f) => f.itemKey === "carrefour-18L")?.factor).toBeCloseTo(12 / 18); // "18 יחיד"
    expect(fallbacks.map((f) => f.itemKey)).not.toContain("rl-12M"); // another kind
    expect(fallbacks.map((f) => f.itemKey)).not.toContain("carrefour-12L"); // same size: not a fallback
  });

  it("never crosses brands or units", () => {
    const keys = scaledFallbacks(["coke-15"], COLA).map((f) => f.itemKey);
    expect(keys).toContain("coke-2");
    expect(keys).not.toContain("pepsi-15");
  });
});

describe("dedupeByName", () => {
  it("keeps one option per product name, the most widely carried", () => {
    const deduped = dedupeByName([
      { name: "ביצים 12 יח גדול L", branchCount: 4, key: "a" },
      { name: "ביצים 12 יח בינוני M", branchCount: 4, key: "b" },
      { name: "ביצים 12 יח גדול L", branchCount: 3, key: "c" },
    ]);
    expect(deduped.map((o) => o.key)).toEqual(["a", "b"]);
  });
});
