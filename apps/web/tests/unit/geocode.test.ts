import { describe, expect, it } from "vitest";
import { cleanBranchAddress, geocodeKey, inCity, parseCoordinates } from "@/src/infrastructure/prices/geocode";

describe("cleanBranchAddress", () => {
  it("puts the house number after the street", () => {
    expect(cleanBranchAddress("64 יוהנה זבוטינסקי")).toBe("יוהנה זבוטינסקי 64");
    expect(cleanBranchAddress("חייל הנדסה1")).toBe("חייל הנדסה 1");
  });

  it("expands the chains' abbreviations", () => {
    expect(cleanBranchAddress("קנ.אביה שד.שאול המלך")).toBe("קניון אביה שדרות שאול המלך");
    expect(cleanBranchAddress("42 שדרות י-ם")).toBe("שדרות ירושלים 42");
    expect(cleanBranchAddress("אורגים פינת ב.ג")).toBe("אורגים פינת בן גוריון");
    expect(cleanBranchAddress("רח' יעקב כהן 8")).toBe("יעקב כהן 8");
  });

  it("has nothing to look up without a street", () => {
    expect(cleanBranchAddress(null)).toBeNull();
    expect(cleanBranchAddress("")).toBeNull();
    expect(cleanBranchAddress("0")).toBeNull();
  });
});

describe("inCity", () => {
  it("matches the city however it's hyphenated", () => {
    expect(inCity("דרך חברון, העיר העתיקה, באר-שבע, נפת באר שבע", "באר שבע")).toBe(true);
    expect(inCity("הרצל, תל אביב-יפו", "באר שבע")).toBe(false);
  });

  it("doesn't take the sub-district for the city", () => {
    expect(inCity("יעקב כהן, דימונה, נפת באר שבע, מחוז הדרום", "באר שבע")).toBe(false);
  });
});

describe("parseCoordinates", () => {
  it("reads coordinates as copied from Google Maps", () => {
    expect(parseCoordinates("31.2341, 34.7996")).toEqual({ lat: 31.2341, lng: 34.7996 });
    expect(parseCoordinates(" 31.2341 34.7996 ")).toEqual({ lat: 31.2341, lng: 34.7996 });
  });

  it("rejects anything else, or a point outside Israel", () => {
    expect(parseCoordinates("באר שבע")).toBeNull();
    expect(parseCoordinates("34.7996, 31.2341")).toBeNull();
    expect(parseCoordinates("")).toBeNull();
  });
});

describe("geocodeKey", () => {
  it("changes with the address, so a moved branch is looked up again", () => {
    expect(geocodeKey("דרך חברון 21", "באר שבע")).not.toBe(geocodeKey("דרך חברון 23", "באר שבע"));
  });
});
