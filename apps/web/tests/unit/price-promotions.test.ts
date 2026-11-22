import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { decodePriceFile, parsePriceFileName, parsePromoFullXml, type ParsedPromotion } from "@/src/infrastructure/prices/parse";
import { isForEveryShopper, promotionDeals } from "@/src/infrastructure/prices/promotions";

const fixture = (name: string) => parsePromoFullXml(decodePriceFile(readFileSync(path.join(__dirname, "../fixtures/prices", name))));
const NOW = "2026-10-24 12:00:00";
const shelf = (prices: Record<string, number>) => (code: string) => prices[code];

describe("parsePromoFullXml", () => {
  it("reads promotions with their own fields, not their items'", () => {
    const { govChainId, storeCode, promotions } = fixture("ramilevy-promofull.xml.gz");
    expect(govChainId).toBe("7290058140886");
    expect(storeCode).toBe("27");
    expect(promotions).toHaveLength(10);
    expect(promotions[0]).toMatchObject({
      promotionId: "0001422642",
      description: "מיץ ענבים 100% רמי לוי ב11.90 כולל",
      startsAt: "2026-08-17 00:00:00",
      endsAt: "2026-10-31 23:59:00",
      clubId: "0",
      isCoupon: false,
      days: null,
      groups: [
        {
          minPurchaseAgorot: 0,
          items: [
            {
              itemCode: "7290018940921",
              rewardType: "3",
              minQty: 1,
              maxQty: null,
              discountedPriceAgorot: 1190,
              isWeighted: false,
            },
          ],
        },
      ],
    });
  });

  it("reads Shufersal's file (UTF-8 BOM, club named '0 - כלל הלקוחות')", () => {
    const { storeCode, promotions } = fixture("shufersal-promofull.xml.gz");
    expect(storeCode).toBe("110");
    expect(promotions[0].clubId).toBe("0 - כלל הלקוחות");
    expect(promotions[0].groups[0].items).toHaveLength(3);
  });

  it("recognizes PromoFull file names", () => {
    expect(parsePriceFileName("PromoFull7290027600007-002-110-20261024-030840.gz")).toEqual({
      kind: "PromoFull",
      govChainId: "7290027600007",
      storeCode: "110",
      timestamp: "2026-10-24 03:08:40",
    });
  });
});

describe("promotionDeals (Rami Levy fixture)", () => {
  const { promotions } = fixture("ramilevy-promofull.xml.gz");
  const deals = promotionDeals(
    promotions,
    shelf({
      "7290018940921": 1390, // grape juice, ב11.90
      "8410376044393": 1790, // השני בחצי, the second at 8.95
      "7290121750134": 1290, // 1+1
      "7290018893494": 790, // 2ב12
      "7290016693041": 1990, // wine 3ב60: dearer than three at the shelf price
      "7290110324773": 590, // club members only
      "54051140": 3000, // coupon
      "7290002681571": 8490, // weighted, ב78.90 per kg, max 3
      "7290002281443": 4540, // "מעל 75": needs a 75₪ basket
      "8595606402713": 900, // 1+1 across two groups
    }),
    NOW,
  );
  const byCode = new Map(deals.map((d) => [d.itemCode, d]));

  it("keeps only promotions every shopper gets, for items the branch sells", () => {
    expect([...byCode.keys()].sort()).toEqual([
      "7290002681571",
      "7290018893494",
      "7290018940921",
      "7290121750134",
      "8410376044393",
    ]);
  });

  it("turns each reward type into a price for minQty units", () => {
    expect(byCode.get("7290018940921")).toMatchObject({ minQty: 1, priceAgorot: 1190, maxQty: null });
    expect(byCode.get("7290018893494")).toMatchObject({ minQty: 2, priceAgorot: 1200 });
    // RewardType 2 discounts the last of minQty units.
    expect(byCode.get("8410376044393")).toMatchObject({ minQty: 2, priceAgorot: 1790 + 895 });
    expect(byCode.get("7290121750134")).toMatchObject({ minQty: 2, priceAgorot: 1290 });
  });

  it("prices weighted items per kg", () => {
    expect(byCode.get("7290002681571")).toMatchObject({ minQty: 1, priceAgorot: 7890, maxQty: null });
  });
});

describe("promotionDeals (Shufersal fixture)", () => {
  const { promotions } = fixture("shufersal-promofull.xml.gz");
  const deals = promotionDeals(
    promotions,
    shelf({
      "7296073705475": 2990, // 2ב45
      "7290008606646": 9000, // 300 גרם ב-22
      "7290004480219": 13900, // 129 לק"ג
      "7290002442066": 2500, // 2 ב-30, but MinQty is 1.5 kg
    }),
    NOW,
  );
  const byCode = new Map(deals.map((d) => [d.itemCode, d]));

  it("handles mix-and-match bundles item by item", () => {
    expect(byCode.get("7296073705475")).toMatchObject({ minQty: 2, priceAgorot: 4500 });
  });

  it("converts a weight deal to per kg, and skips deals needing more than a kg", () => {
    expect(byCode.get("7290008606646")).toMatchObject({ minQty: 1, priceAgorot: 7333 });
    expect(byCode.get("7290004480219")).toMatchObject({ minQty: 1, priceAgorot: 12900 });
    expect(byCode.has("7290002442066")).toBe(false);
  });
});

describe("promotionDeals rules", () => {
  const promotion = (patch: Partial<ParsedPromotion> = {}, item: Partial<ParsedPromotion["groups"][0]["items"][0]> = {}): ParsedPromotion => ({
    promotionId: "1",
    description: "2 ב-10",
    startsAt: "2026-10-01 00:00:00",
    endsAt: "2026-10-31 23:59:00",
    startHour: null,
    days: null,
    clubId: "0",
    isCoupon: false,
    redemptionLimit: null,
    groups: [
      {
        minPurchaseAgorot: null,
        items: [{ itemCode: "A", rewardType: "1", minQty: 2, maxQty: null, discountedPriceAgorot: 1000, isWeighted: false, ...item }],
      },
    ],
    ...patch,
  });
  const dealsOf = (p: ParsedPromotion, price = 700) => promotionDeals([p], () => price, NOW);

  it("accepts a plain all-customers promotion", () => {
    expect(dealsOf(promotion())).toEqual([
      {
        promotionId: "1",
        description: "2 ב-10",
        itemCode: "A",
        minQty: 2,
        priceAgorot: 1000,
        maxQty: null,
        startsAt: "2026-10-01 00:00:00",
        endsAt: "2026-10-31 23:59:00",
      },
    ]);
  });

  it("skips ended promotions and those not better than the shelf price", () => {
    expect(dealsOf(promotion({ endsAt: "2026-10-24 11:59:00" }))).toEqual([]);
    expect(dealsOf(promotion(), 500)).toEqual([]);
  });

  it("skips clubs, coupons, weekday and evening windows, and minimum baskets", () => {
    expect(isForEveryShopper(promotion())).toBe(true);
    expect(isForEveryShopper(promotion({ clubId: "1 - מועדון עובדים" }))).toBe(false);
    expect(isForEveryShopper(promotion({ clubId: null }))).toBe(false);
    expect(isForEveryShopper(promotion({ isCoupon: true }))).toBe(false);
    expect(isForEveryShopper(promotion({ days: "6" }))).toBe(false);
    expect(isForEveryShopper(promotion({ startHour: "18:00:00.000" }))).toBe(false);
    expect(isForEveryShopper(promotion({ startHour: "00:01:00.000" }))).toBe(true);
    expect(isForEveryShopper(promotion({ description: "עד 2 יח מעל 99" }))).toBe(false);
    const withBasket = promotion();
    withBasket.groups[0].minPurchaseAgorot = 7500;
    expect(isForEveryShopper(withBasket)).toBe(false);
  });

  it("caps the discounted units by MaxQty and RedemptionLimit", () => {
    expect(dealsOf(promotion({}, { maxQty: 4 }))[0].maxQty).toBe(4);
    expect(dealsOf(promotion({ redemptionLimit: 1 }))[0].maxQty).toBe(2);
    expect(dealsOf(promotion({}, { maxQty: 1 }))).toEqual([]);
  });

  it("skips free gifts and unknown reward types", () => {
    expect(dealsOf(promotion({}, { discountedPriceAgorot: 0 }))).toEqual([]);
    expect(dealsOf(promotion({}, { rewardType: "0" }))).toEqual([]);
  });
});
