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

interface Profile {
  size: Size | null;
  percent: string | null;
  words: Set<string>;
}

function profile(option: EquivalenceOption, commonWords: Set<string>): Profile {
  const normalized = normalizeRetailName(option.name);
  const brandWords = new Set(option.manufacturer ? normalizeRetailName(option.manufacturer).split(" ") : []);
  const words = normalized
    .split(" ")
    .filter(Boolean)
    .map((w) => SIZE_CLASS[w] ?? w)
    .filter((w) => !commonWords.has(w) && !/^[\d.%]+$/.test(w) && !IGNORED.has(w) && !brandWords.has(w));
  return { size: sizeFromName(normalized), percent: percentOf(normalized), words: new Set(words) };
}

const sameSize = (a: Size | null, b: Size | null) =>
  a === null || b === null ? a === b : a.base === b.base && Math.abs(a.amount - b.amount) <= a.amount * 0.15;

/** Item keys of the options equivalent to `chosenKey` (not including it). */
export function equivalentKeys(chosenKey: string, options: EquivalenceOption[]): string[] {
  const chosen = options.find((o) => o.itemKey === chosenKey);
  if (!chosen || options.length < 2) return [];
  // Words every option shares ("ביצים") say nothing about which one it is.
  const wordSets = options.map((o) => new Set(normalizeRetailName(o.name).split(" ")));
  const commonWords = new Set([...wordSets[0]].filter((w) => wordSets.every((set) => set.has(w))));

  const want = profile(chosen, commonWords);
  return options
    .filter((o) => o.itemKey !== chosenKey)
    .filter((o) => {
      const p = profile(o, commonWords);
      // Exactly the same distinguishing words: omega eggs aren't plain eggs either way round.
      const sameWords = want.words.size === p.words.size && [...want.words].every((w) => p.words.has(w));
      return sameSize(want.size, p.size) && want.percent === p.percent && sameWords;
    })
    .map((o) => o.itemKey);
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
