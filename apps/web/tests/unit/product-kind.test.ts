import { describe, expect, it } from "vitest";
import { lineKinds, lineNamesPack, matchesKind, packForm, placeKindLabel } from "@smartroute/core/application/routing/product-kind";

const p = (canonicalName: string, shelfGroup: string) => ({ canonicalName, shelfGroup });
const labels = (products: ReturnType<typeof p>[]) => lineKinds(products).map((k) => k.label);

describe("packForm", () => {
  it.each([
    ["קוקה קולה בקבוק 1.5 ליטר", "single"],
    ["קוקה קולה בפחית 330 מ\"ל", "can"],
    ["קוקה קולה שישייה 1.75 ליטר", "sixpack"],
    ["מארז קוקה קולה 6 פחיות", "sixpack"],
    ["פפסי קולה 6 x 1.5 ליטר", "sixpack"],
    ["מארז קוקה קולה 6*2 ליטר", "sixpack"],
    ["קוקה קולה מארז 4 בקבוקים 1 ליטר", "pack"],
    ["קוקה קולה 12 יחידות 150 מ\"ל", "pack"],
  ])("reads %s as %s", (name, form) => {
    expect(packForm(p(name, "soft-drinks"))).toBe(form);
  });

  it("doesn't take a count off the drinks shelves for a multipack", () => {
    expect(packForm(p("ביצים 12 יחידות", "eggs"))).toBe("single");
    expect(packForm(p("מארז במבה 8 יחידות", "salty-snacks"))).toBe("pack");
  });
});

describe("lineKinds", () => {
  it("offers packaging when the line's products are all one product", () => {
    const cola = [p("קולה 1.5 ליטר", "soft-drinks"), p("קולה בפחית 330 מל", "soft-drinks"), p("קולה שישייה 1.5 ליטר", "soft-drinks")];
    expect(labels(cola)).toEqual(["בקבוק", "פחית", "שישייה"]);
  });

  it("offers what the products are when they're really different, the commonest first", () => {
    const hummus = [
      p("חומוס אחלה", "chilled-salads-dips"),
      p("חומוס צבר", "chilled-salads-dips"),
      p("גרגירי חומוס 800 גרם", "canned-legumes"),
    ];
    expect(labels(hummus)).toEqual(["ממרח או סלט", "שימורים"]);
  });

  it("joins groups that read the same into one button", () => {
    const kinds = lineKinds([p("שום", "vegetables"), p("שום כתוש", "fruits"), p("שום קפוא", "frozen-vegetables")]);
    expect(kinds.map((k) => k.label)).toEqual(["טרי", "קפוא"]);
    expect(kinds[0].groups.sort()).toEqual(["fruits", "vegetables"]);
  });

  it("has nothing to offer for one kind in one packaging, or one stray multipack of food", () => {
    expect(lineKinds([p("מלח דק", "spices"), p("מלח גס", "spices")])).toEqual([]);
    expect(lineKinds([p("אורז בסמטי", "rice"), p("אורז פרסי", "rice"), p("מארז אורז", "rice")])).toEqual([]);
    expect(lineKinds([])).toEqual([]);
  });

  it("offers at most four", () => {
    const groups = ["canned-fish", "fresh-fish", "chilled-salads-dips", "frozen-fish", "smoked-pickled-fish"];
    expect(lineKinds(groups.map((g) => p("טונה", g)))).toHaveLength(4);
  });
});

describe("matchesKind", () => {
  it("needs the group, and the packaging when the kind names one", () => {
    const six = p("קולה שישייה 1.5 ליטר", "soft-drinks");
    expect(matchesKind(six, { groups: ["soft-drinks"] })).toBe(true);
    expect(matchesKind(six, { groups: ["soft-drinks"], form: "sixpack" })).toBe(true);
    expect(matchesKind(six, { groups: ["soft-drinks"], form: "can" })).toBe(false);
    expect(matchesKind(six, { groups: ["water"] })).toBe(false);
    expect(matchesKind({ canonicalName: "קולה" }, { groups: ["soft-drinks"] })).toBe(false);
  });
});

describe("lineNamesPack", () => {
  it.each(["שישיית קולה", "קולה בפחית", "מארז קולה", "קולה בקבוק"])("%s already says", (line) => {
    expect(lineNamesPack(line)).toBe(true);
  });
  it("doesn't mistake other words for packaging", () => {
    expect(lineNamesPack("תפוחים")).toBe(false);
    expect(lineNamesPack("קולה")).toBe(false);
  });
});

describe("placeKindLabel", () => {
  const bottle = p("קולה 1.5 ליטר", "soft-drinks");
  const six = p("קולה שישייה 1.5 ליטר", "soft-drinks");
  const canned = p("גרגירי חומוס", "canned-legumes");
  const spread = p("חומוס אחלה", "chilled-salads-dips");

  it("names a place by its packaging, or by what it is", () => {
    expect(placeKindLabel([six], [bottle])).toBe("שישיות");
    expect(placeKindLabel([canned], [spread])).toBe("שימורים");
  });

  it("has no name for a mix, or for the same thing as elsewhere", () => {
    expect(placeKindLabel([six, bottle], [bottle])).toBeUndefined();
    expect(placeKindLabel([bottle], [bottle])).toBeUndefined();
    expect(placeKindLabel([{ canonicalName: "קולה" }], [bottle])).toBeUndefined();
  });
});
