import { describe, expect, it } from "vitest";
import { diceCoefficient } from "@/src/application/classification/dice-coefficient";

describe("diceCoefficient", () => {
  it("returns 1 for identical strings", () => {
    expect(diceCoefficient("קולה", "קולה")).toBe(1);
  });

  it("returns 0 for completely disjoint strings", () => {
    expect(diceCoefficient("קולה", "לחם")).toBe(0);
  });

  it("scores partial overlaps between 0 and 1", () => {
    const score = diceCoefficient("חלב תנובה", "חלב תנובה 3%");
    expect(score).toBeGreaterThan(0.7);
    expect(score).toBeLessThan(1);
  });

  it("is tolerant of word order (bigram sets, not positional edits)", () => {
    const score = diceCoefficient("תנובה חלב", "חלב תנובה");
    expect(score).toBeGreaterThan(0.5);
  });

  it("scores a one-letter typo as a near miss, not a mismatch", () => {
    const score = diceCoefficient("עגבניוט", "עגבניות");
    expect(score).toBeGreaterThan(0.6);
    expect(score).toBeLessThan(1);
  });
});
