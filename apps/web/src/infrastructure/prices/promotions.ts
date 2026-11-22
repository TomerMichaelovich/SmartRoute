import type { ParsedPromotion, ParsedPromotionItem } from "./parse";

/**
 * PromoFull promotions -> deals the basket quote can apply: `minQty` units of
 * one item for `priceAgorot`. Only promotions every shopper gets are kept: no
 * loyalty clubs, coupons, minimum basket, multi-group conditions ("buy X, get
 * Y") or weekday/evening windows. A promotion over several items ("2 ב-45,
 * קלאסי/אמריקאי") becomes one deal per item — mixing items isn't modeled, so
 * the quote can only miss a saving, never invent one.
 *
 * What DiscountedPrice means depends on RewardType (checked against the shelf
 * prices of all five pilot chains, 2026-10-24):
 *   1, 10  the price of MinQty units          "2 ב-20" -> MinQty 2, 20.00
 *   3      the unit price                     MinQty 1
 *   2      the price of the last of MinQty    "השני בחצי" -> MinQty 2, 8.95; 1+1 -> 0.00
 * Weighted items have MinQty 0.01 (DiscountedPrice is then per kg) or a weight
 * ("300 גרם ב-22" -> 0.3, 22.00); their deals are stored per kg.
 */

export interface PromotionDeal {
  promotionId: string;
  description: string;
  itemCode: string;
  minQty: number;
  /** The price of minQty units (per kg for weighted items, where minQty is 1). */
  priceAgorot: number;
  /** Most units sold at the promotion price per purchase; null = no limit. */
  maxQty: number | null;
  startsAt: string;
  endsAt: string;
}

const REWARD_TYPES = new Set(["1", "2", "3", "10"]);
/** Later start hours are evening deals ("happy hour"); hours before it just repeat the start date's time. */
const LATEST_START_HOUR = "06:00";
/** "מעל 75" / "מעל99": a minimum basket that some chains (Yohananof) state only in the description. */
const MIN_BASKET_IN_TEXT = /מעל\s?\d/;
/** A weighted MinQty under this means "any amount" (0.01): DiscountedPrice is per kg. */
const ANY_WEIGHT = 0.05;

export function isForEveryShopper(p: ParsedPromotion): boolean {
  if (!p.clubId || !/^0(\D|$)/.test(p.clubId)) return false;
  if (p.isCoupon || p.days || MIN_BASKET_IN_TEXT.test(p.description)) return false;
  if (p.startHour && p.startHour.slice(0, 5) > LATEST_START_HOUR) return false;
  return p.groups.length === 1 && !(p.groups[0].minPurchaseAgorot && p.groups[0].minPurchaseAgorot > 0);
}

function deal(
  p: ParsedPromotion,
  item: ParsedPromotionItem,
  shelfAgorot: number,
): Omit<PromotionDeal, "promotionId" | "description" | "itemCode" | "startsAt" | "endsAt"> | null {
  const { rewardType, minQty, discountedPriceAgorot: price } = item;
  if (!rewardType || !REWARD_TYPES.has(rewardType) || minQty === null || minQty <= 0 || price === null) return null;
  // Only "1+1" (the second unit free) may be priced 0.
  if (price < 0 || (price === 0 && !(rewardType === "2" && minQty > 1))) return null;

  if (item.isWeighted || !Number.isInteger(minQty)) {
    // The quote prices weighted items per kg; a deal needing more than a kg isn't one the shopper gets.
    if (minQty > 1) return null;
    const perKg = minQty < ANY_WEIGHT ? price : Math.round(price / minQty);
    return perKg < shelfAgorot ? { minQty: 1, priceAgorot: perKg, maxQty: null } : null;
  }

  const total = rewardType === "2" ? (minQty - 1) * shelfAgorot + price : price;
  // Promotions no better than the shelf price exist (expired, or already in PriceFull).
  if (total >= minQty * shelfAgorot) return null;
  const caps = [
    item.maxQty !== null && item.maxQty > 0 ? Math.floor(item.maxQty) : null,
    p.redemptionLimit !== null && p.redemptionLimit > 0 ? p.redemptionLimit * minQty : null,
  ].filter((c): c is number => c !== null);
  const maxQty = caps.length ? Math.min(...caps) : null;
  if (maxQty !== null && maxQty < minQty) return null;
  return { minQty, priceAgorot: total, maxQty };
}

/**
 * The deals of a branch's PromoFull, for items it sells (`shelfAgorot` is the
 * branch's PriceFull price) and still running at `now` (Israel-local
 * "YYYY-MM-DD HH:mm:ss"). One deal per item and promotion; the last row wins.
 */
export function promotionDeals(
  promotions: ParsedPromotion[],
  shelfAgorot: (itemCode: string) => number | undefined,
  now: string,
): PromotionDeal[] {
  const out = new Map<string, PromotionDeal>();
  for (const p of promotions) {
    if (!p.startsAt || !p.endsAt || p.endsAt <= now || !isForEveryShopper(p)) continue;
    for (const item of p.groups[0].items) {
      const shelf = shelfAgorot(item.itemCode);
      if (shelf === undefined) continue;
      const d = deal(p, item, shelf);
      if (!d) continue;
      out.set(`${item.itemCode}|${p.promotionId}`, {
        promotionId: p.promotionId,
        description: p.description,
        itemCode: item.itemCode,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        ...d,
      });
    }
  }
  return [...out.values()];
}
