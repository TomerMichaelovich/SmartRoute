import { describe, expect, it } from "vitest";
import { listLineCores, parseLineQuantity, withoutQuantities } from "@smartroute/core/application/classification/list-line";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";

const n = normalizeHebrewText;

describe("parseLineQuantity", () => {
  it("reads a leading count", () => {
    expect(parseLineQuantity("3 חלב")).toBe(3);
    expect(parseLineQuantity("2 קולה 1.5 ליטר")).toBe(2);
  });

  it("reads x2 / 2x / ×2", () => {
    expect(parseLineQuantity("חלב x2")).toBe(2);
    expect(parseLineQuantity("חלב 2x")).toBe(2);
    expect(parseLineQuantity("×3 במבה")).toBe(3);
  });

  it("doesn't take a size or a trailing pack count for a quantity", () => {
    expect(parseLineQuantity('1 ק"ג חזה עוף')).toBeUndefined();
    expect(parseLineQuantity('2 ק"ג עגבניות')).toBeUndefined();
    expect(parseLineQuantity("שמן 2 ליטר")).toBeUndefined();
    expect(parseLineQuantity("ביצים 30")).toBeUndefined();
    expect(parseLineQuantity("חלב 3%")).toBeUndefined();
  });

  it("ignores 1 and implausible counts", () => {
    expect(parseLineQuantity("1 חלב")).toBeUndefined();
    expect(parseLineQuantity("99 חלב")).toBeUndefined();
  });
});

describe("withoutQuantities", () => {
  it("drops counts, sizes and units, keeping fat %", () => {
    expect(withoutQuantities(n('2 ק"ג עגבניות'))).toBe("עגבניות");
    expect(withoutQuantities(n("2 קולה 1.5 ליטר"))).toBe("קולה");
    expect(withoutQuantities(n("נייר טואלט 32 גלילים"))).toBe("נייר טואלט");
    expect(withoutQuantities(n("שישיית מים"))).toBe("מים");
    expect(withoutQuantities(n("חלב x2"))).toBe("חלב");
    expect(withoutQuantities(n("חלב 3%"))).toBe("חלב 3%");
  });
});

describe("listLineCores", () => {
  it("strips brands, then the fat %", () => {
    expect(listLineCores(n("קוטג' תנובה 5%"))).toEqual(["קוטג 5%", "קוטג"]);
    expect(listLineCores(n("שמן זית יד מרדכי"))).toEqual(["שמן זית"]);
  });

  it("keeps a brand that is the whole line", () => {
    expect(listLineCores(n("תנובה"))).toEqual([]);
  });

  it("doesn't drop brands that name the product", () => {
    expect(listLineCores(n("פריגת תפוזים"))).toEqual([]);
  });
});
