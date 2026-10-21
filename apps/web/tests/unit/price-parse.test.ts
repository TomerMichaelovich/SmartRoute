import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  decodePriceFile,
  itemKeyFor,
  normalizeStoreCode,
  parsePriceFileName,
  parsePriceFullXml,
  parseStoresXml,
} from "@/src/infrastructure/prices/parse";
import {
  cityCodeFromBranchName,
  cityCodeFromName,
  cityCodeFromStoresValue,
} from "@/src/infrastructure/prices/settlements";

const fixture = (name: string) => readFileSync(path.join(__dirname, "../fixtures/prices", name));

describe("decodePriceFile", () => {
  it("gunzips and strips the UTF-8 BOM", () => {
    const xml = decodePriceFile(fixture("shufersal-stores.xml.gz"));
    expect(xml.startsWith("<?xml")).toBe(true);
  });

  it("decodes plain UTF-16LE (Cerberus Stores)", () => {
    const xml = decodePriceFile(fixture("ramilevy-stores.xml"));
    expect(xml.startsWith("<Root>")).toBe(true);
    expect(xml).toContain("רמי לוי");
  });
});

describe("parseStoresXml", () => {
  it("reads Shufersal's <Chain>/<SubChains> layout with sub-chain context", () => {
    const { govChainId, branches } = parseStoresXml(decodePriceFile(fixture("shufersal-stores.xml.gz")));
    expect(govChainId).toBe("7290027600007");
    expect(branches.length).toBeGreaterThan(0);
    expect(branches[0]).toMatchObject({ storeCode: "756", subChainName: "שופרסל שלי", cityRaw: "2530" });
  });

  it("reads Cerberus <Root> layout and drops leading zeros from store ids", () => {
    const { govChainId, branches } = parseStoresXml(decodePriceFile(fixture("ramilevy-stores.xml")));
    expect(govChainId).toBe("7290058140886");
    expect(branches[0]).toMatchObject({ storeCode: "1", name: "תלפיות", cityRaw: "3000" });
  });
});

describe("parsePriceFullXml", () => {
  const shufersal = parsePriceFullXml(decodePriceFile(fixture("shufersal-pricefull.xml.gz")));
  const ramiLevy = parsePriceFullXml(decodePriceFile(fixture("ramilevy-pricefull.xml.gz")));

  it("reads header and items", () => {
    expect(shufersal).toMatchObject({ govChainId: "7290027600007", storeCode: "374" });
    expect(ramiLevy).toMatchObject({ govChainId: "7290058140886", storeCode: "1" });
    expect(shufersal.items).toHaveLength(40);
  });

  it("converts prices to agorot and maps ManufactureName", () => {
    const milk = shufersal.items.find((i) => i.itemCode === "7290116936307")!;
    expect(milk).toMatchObject({ name: "חלב 3% מהדרין 2ל תנובה", manufacturer: 'תנובה בע"מ', priceAgorot: 1470 });
    expect(milk.quantity).toBe(2);
  });

  it("treats placeholder manufacturers as missing", () => {
    expect(shufersal.items.find((i) => i.itemCode === "7290010945306")!.manufacturer).toBeNull(); // "---"
    expect(ramiLevy.items.find((i) => i.itemCode === "7290001794852")!.manufacturer).toBeNull(); // "לא ידוע"
  });

  it("flags weighted produce", () => {
    const tomato = shufersal.items.find((i) => i.name === "עגבניה")!;
    expect(tomato.isWeighted).toBe(true);
  });

  it("the same barcode appears at both chains", () => {
    const codes = new Set(ramiLevy.items.map((i) => i.itemCode));
    expect(codes.has("7290116936307")).toBe(true);
  });
});

describe("itemKeyFor", () => {
  it("keys packaged goods by barcode", () => {
    expect(itemKeyFor("shufersal", { itemCode: "7290116936307", itemType: "1", isWeighted: false })).toEqual({
      itemKey: "7290116936307",
      internal: false,
    });
  });

  it("keys produce codes per chain even when they look like barcodes", () => {
    expect(itemKeyFor("shufersal", { itemCode: "7290000000046", itemType: "1", isWeighted: true }).itemKey).toBe(
      "shufersal:7290000000046",
    );
    expect(itemKeyFor("rami-levy", { itemCode: "7290000000916", itemType: "1", isWeighted: false }).itemKey).toBe(
      "rami-levy:7290000000916",
    );
    expect(itemKeyFor("x", { itemCode: "1234", itemType: "1", isWeighted: false }).internal).toBe(true);
    expect(itemKeyFor("x", { itemCode: "7290000040974", itemType: "0", isWeighted: false }).internal).toBe(true);
  });
});

describe("parsePriceFileName", () => {
  it("parses chain-sub-store-date-time names", () => {
    expect(parsePriceFileName("PriceFull7290027600007-001-374-20261021-043100.gz")).toEqual({
      kind: "PriceFull",
      govChainId: "7290027600007",
      storeCode: "374",
      timestamp: "2026-10-21 04:31:00",
    });
  });

  it("parses the legacy chain-store-datetime names so they lose on recency", () => {
    expect(parsePriceFileName("PriceFull7290803800003-7999-202412271528.gz")).toMatchObject({
      storeCode: "7999",
      timestamp: "2024-12-27 15:28:00",
    });
    expect(parsePriceFileName("pricefull7290058140886-039-202607150513.gz")).toMatchObject({
      kind: "PriceFull",
      storeCode: "39",
    });
  });

  it("parses Stores names without a store", () => {
    expect(parsePriceFileName("Stores7290058140886-000-20261021-050501.xml")).toMatchObject({
      kind: "Stores",
      storeCode: null,
      timestamp: "2026-10-21 05:05:01",
    });
  });

  it("does not confuse Price with PriceFull", () => {
    expect(parsePriceFileName("Price7290055700007-001-914-20261021-070013.gz")?.kind).toBe("Price");
  });

  it("rejects unrelated names", () => {
    expect(parsePriceFileName("readme.txt")).toBeNull();
  });
});

describe("normalizeStoreCode", () => {
  it("strips leading zeros but keeps a lone zero", () => {
    expect(normalizeStoreCode("001")).toBe("1");
    expect(normalizeStoreCode("000")).toBe("0");
    expect(normalizeStoreCode("374")).toBe("374");
  });
});

describe("settlements", () => {
  it("resolves CBS codes and names in any common spelling", () => {
    expect(cityCodeFromStoresValue("9000")).toBe(9000);
    expect(cityCodeFromStoresValue("0")).toBeNull();
    expect(cityCodeFromStoresValue("באר שבע")).toBe(9000);
    for (const name of ["באר-שבע", 'ב"ש', "Beersheba", "Be'er Sheva", "BE'ER SHEVA", "Beer Sheva"]) {
      expect(cityCodeFromName(name), name).toBe(9000);
    }
    expect(cityCodeFromName("תל אביב")).toBe(5000);
    expect(cityCodeFromName("עיר שלא קיימת")).toBeNull();
  });

  it("falls back to the branch name only as whole words", () => {
    expect(cityCodeFromBranchName("באר שבע")).toBe(9000);
    expect(cityCodeFromBranchName("ביג באר שבע החדש")).toBe(9000);
    expect(cityCodeFromBranchName("אקספרס להבים באר שבע")).not.toBeNull();
  });
});
