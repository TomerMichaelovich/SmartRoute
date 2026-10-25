import { normalizeRetailName } from "./ingest";
import { percentOf, sizeFromName, type Size } from "./sku-rules";

/**
 * When a shopper picks "ביצים 12 יח גדול L" in the refinement popup they mean
 * that kind of product, not one chain's barcode — every chain packs its own
 * eggs. So a branch that doesn't sell the exact pick is priced with the
 * cheapest equivalent it does sell: same generic product, same size and fat %,
 * and the same distinguishing words (size class, "אומגה", the brand in the
 * name: "קוקה קולה" never becomes "פפסי קולה").
 */

export interface EquivalenceOption {
  itemKey: string;
  name: string;
  manufacturer: string | null;
}

// Egg / produce size classes are written both ways.
const SIZE_CLASS: Record<string, string> = {
  גדול: "l",
  גדולות: "l",
  בינוני: "m",
  בינוניות: "m",
  בנוני: "m",
  ענק: "xl",
  קטן: "s",
  קטנות: "s",
};
// Units, and packaging words that don't change what the product is.
const IGNORED = new Set([
  "יח", "יחידות", "יחיד", "י", "ל", "ליטר", "מל", "מ", "ג", "גר", "גרם", "ק", "קג", "%",
  "ארוז", "ארוזה", "ארוזות", "רגיל", "רגילה", "רגילות", "מארז",
]);

// A chain's own brand, however its file spells or cuts it short ("טחינה 400ג רמילוי",
// "סוכר לבן 1 ק"ג רמי ל", "מלח שולחן דק שופרסל 1 קג").
const CHAIN_BRAND = "רמי לוי|רמי לו|רמי ל|רמילוי|רמילו|רמיל|שופרסל|שופרס|יוחננוף|יוחננו|אושר עד|קרפור";
const CHAIN_BRAND_WORDS = new RegExp(`(^|\\s)(${CHAIN_BRAND})(?=\\s|$)|(^|\\s)רמי$`, "g");
const hasChainBrand = (text: string) => new RegExp(CHAIN_BRAND_WORDS.source).test(text);

interface Profile {
  size: Size | null;
  percent: string | null;
  words: Set<string>;
  /** A chain's own brand: equivalent to another chain's own brand of the same kind, never to a national one. */
  privateLabel: boolean;
}

function profile(option: EquivalenceOption, commonWords: Set<string>): Profile {
  const normalized = normalizeRetailName(option.name);
  const manufacturer = option.manufacturer ? normalizeRetailName(option.manufacturer) : "";
  const brandWords = new Set(manufacturer.split(" "));
  const privateLabel = hasChainBrand(normalized) || hasChainBrand(manufacturer);
  const words = normalized
    .replace(CHAIN_BRAND_WORDS, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => SIZE_CLASS[w] ?? w)
    .filter((w) => !commonWords.has(w) && !/^[\d.%]+$/.test(w) && !IGNORED.has(w) && !brandWords.has(w));
  return { size: sizeFromName(normalized), percent: percentOf(normalized), words: new Set(words), privateLabel };
}

const sameSize = (a: Size | null, b: Size | null) =>
  a === null || b === null ? a === b : a.base === b.base && Math.abs(a.amount - b.amount) <= a.amount * 0.15;

/** Words every option shares ("ביצים") say nothing about which one it is. */
function commonWordsOf(options: EquivalenceOption[]): Set<string> {
  const wordSets = options.map((o) => new Set(normalizeRetailName(o.name).split(" ")));
  return new Set([...(wordSets[0] ?? [])].filter((w) => wordSets.every((set) => set.has(w))));
}

// Exactly the same distinguishing words: omega eggs aren't plain eggs either way round.
const sameKind = (a: Profile, b: Profile) =>
  a.privateLabel === b.privateLabel &&
  a.percent === b.percent &&
  a.words.size === b.words.size &&
  [...a.words].every((w) => b.words.has(w));

/** Item keys of the options equivalent to `chosenKey` (not including it). */
export function equivalentKeys(chosenKey: string, options: EquivalenceOption[]): string[] {
  const chosen = options.find((o) => o.itemKey === chosenKey);
  if (!chosen || options.length < 2) return [];
  const commonWords = commonWordsOf(options);
  const want = profile(chosen, commonWords);
  return options
    .filter((o) => o.itemKey !== chosenKey)
    .filter((o) => {
      const p = profile(o, commonWords);
      return sameSize(want.size, p.size) && sameKind(want, p);
    })
    .map((o) => o.itemKey);
}

/**
 * The same kind of product in another pack size, with the factor that prices it
 * per unit at the target size: a branch selling only 18-egg trays is compared
 * on 12 eggs at 12/18 of the tray's price. Used only where a branch has nothing
 * in the target size itself.
 */
export function scaledFallbacks(
  targetKeys: string[],
  options: EquivalenceOption[],
): { itemKey: string; factor: number }[] {
  const targetSet = new Set(targetKeys);
  const commonWords = commonWordsOf(options);
  const targets = options.filter((o) => targetSet.has(o.itemKey)).map((o) => profile(o, commonWords));
  const out: { itemKey: string; factor: number }[] = [];
  for (const option of options) {
    if (targetSet.has(option.itemKey)) continue;
    const p = profile(option, commonWords);
    if (!p.size) continue;
    const target = targets.find((t) => t.size && t.size.base === p.size!.base && !sameSize(t.size, p.size) && sameKind(t, p));
    if (target?.size) out.push({ itemKey: option.itemKey, factor: target.size.amount / p.size.amount });
  }
  return out;
}

/** One popup option per distinct product name — chains often list the same product under their own barcode. */
export function dedupeByName<T extends { name: string; branchCount: number }>(options: T[]): T[] {
  const byName = new Map<string, T>();
  for (const option of options) {
    const key = normalizeRetailName(option.name);
    const kept = byName.get(key);
    if (!kept || option.branchCount > kept.branchCount) byName.set(key, option);
  }
  // Keep the original (most-carried-first) order.
  return options.filter((o) => byName.get(normalizeRetailName(o.name)) === o);
}
