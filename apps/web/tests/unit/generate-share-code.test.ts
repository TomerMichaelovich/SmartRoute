import { describe, expect, it } from "vitest";
import {
  generateShareCode,
  normalizeShareCode,
} from "@smartroute/core/application/shopping-list/generate-share-code";

describe("generateShareCode", () => {
  it("defaults to 6 chars and honours an explicit length", () => {
    expect(generateShareCode()).toHaveLength(6);
    expect(generateShareCode(8)).toHaveLength(8);
  });

  it("only uses the unambiguous alphabet (no 0/O/1/I)", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShareCode(10)).toMatch(/^[2-9A-HJ-NP-Z]+$/);
    }
  });
});

describe("normalizeShareCode", () => {
  it("uppercases, trims, and strips separators", () => {
    expect(normalizeShareCode("  ab-cd 12 ")).toBe("ABCD12");
  });

  it("drops characters outside A-Z0-9", () => {
    expect(normalizeShareCode("a!b@c#3")).toBe("ABC3");
  });
});
