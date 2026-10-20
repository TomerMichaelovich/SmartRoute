import { describe, expect, it } from "vitest";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { rankStoreCandidates } from "@smartroute/core/application/classification/rank-store-candidates";
import { sameInstant } from "@smartroute/core/application/shopping-list/same-instant";
import type { Product } from "@smartroute/core/domain/entities/product";

describe("sameInstant", () => {
  it("treats the ISO and the Postgres spelling of one moment as equal", () => {
    expect(sameInstant("2026-10-13T10:33:34.507Z", "2026-10-13 10:33:34.507")).toBe(true);
  });

  it("tells different moments apart", () => {
    expect(sameInstant("2026-10-13T10:33:34.507Z", "2026-10-13 10:33:35.507")).toBe(false);
  });

  it("only matches a missing timestamp with a missing one", () => {
    expect(sameInstant(undefined, undefined)).toBe(true);
    expect(sameInstant("2026-10-13T10:33:34.507Z", null)).toBe(false);
  });
});

function product(id: string, canonicalName: string, aliases: string[] = []): Product {
  return {
    id,
    canonicalName,
    aliases,
    normalizedAliases: [canonicalName, ...aliases].map(normalizeHebrewText),
    category: "pantry",
    department: "קפה",
    isActive: true,
  };
}

describe("rankStoreCandidates", () => {
  const carried = [
    product("elite", "נס קפה עלית"),
    product("gold", "נסקפה גולד"),
    product("tea", "תה ויסוצקי"),
    product("milk", "חלב"),
  ];

  it("offers every product of the branch an ambiguous name could mean", () => {
    const ids = rankStoreCandidates("נס", carried).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(["elite", "gold"]));
    expect(ids).not.toContain("tea");
  });

  it("puts an exact name first", () => {
    expect(rankStoreCandidates("חלב", carried)[0]?.id).toBe("milk");
  });
});
