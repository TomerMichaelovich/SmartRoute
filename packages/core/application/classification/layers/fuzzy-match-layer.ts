import type { Product } from "@smartroute/core/domain/entities/product";
import type { ClassificationLayer } from "../classification-layer.interface";
import { diceCoefficient } from "../dice-coefficient";
import { fuzzyCore } from "../list-line";

export const HIGH_CONFIDENCE_THRESHOLD = 0.85;
export const MIN_THRESHOLD = 0.6;
export const MAX_ALTERNATIVES = 3;

/**
 * Scores every product against the normalized input regardless of threshold, sorted best
 * first - unlike classify() below (which only accepts >= MIN_THRESHOLD), this powers the
 * Classification Review screen's "closest suggestions" for items no layer could resolve.
 */
export function scoreCandidates(
  normalized: string,
  products: Product[],
): Array<{ productId: string; confidence: number }> {
  const scored: Array<{ productId: string; confidence: number }> = [];
  for (const product of products) {
    let best = 0;
    for (const alias of product.normalizedAliases) {
      const score = diceCoefficient(normalized, alias);
      if (score > best) best = score;
    }
    if (best > 0) scored.push({ productId: product.id, confidence: best });
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  return scored;
}

const FINAL_LETTERS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

// Leading words that qualify the noun after them: "דג סלמון" / "פילה סלמון" are both salmon,
// and a package says nothing about what's in it - "שקיות פח" are bin bags, not tea bags.
const QUALIFIERS = new Set([
  "דג", "דגי", "פילה", "מיני", "שימורי", "שימורים",
  "שקית", "שקיות", "קופסת", "בקבוק", "פחית", "צנצנת", "חבילת",
]);

const contentWords = (text: string) =>
  text
    .split(" ")
    .filter((w) => w.length >= 2 && !/\d/.test(w))
    .map((w) => w.replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]));

const headOf = (words: string[]) => words.find((w) => !QUALIFIERS.has(w)) ?? words[0];

/** Equal up to a typo: none for short words, one letter up to 6, two beyond. */
function similarWords(a: string, b: string): boolean {
  const shorter = Math.min(a.length, b.length);
  const allowed = shorter <= 3 ? 0 : shorter <= 6 ? 1 : 2;
  return editDistance(a, b) <= allowed;
}

/**
 * Whether the product's alias and the line name the same kind of thing: their
 * head nouns (the first word in Hebrew - "מיץ תפוחים" is juice) may differ by
 * a typo, no more - or be swapped ("תירס שימורים" / "שימורי תירס"). Character
 * bigrams alone happily match "שוקו" to "שוקולד חלב", "תה שחור" to "קפה שחור"
 * and "דני" to "דניס".
 */
export function sameHeadWord(line: string, alias: string): boolean {
  const lineWords = contentWords(line);
  const aliasWords = contentWords(alias);
  const a = headOf(lineWords);
  const b = headOf(aliasWords);
  if (!a || !b) return false;
  if (similarWords(a, b)) return true;
  return aliasWords.some((w) => similarWords(a, w)) && lineWords.some((w) => similarWords(b, w));
}

/**
 * The fuzzy layer's pick: scored over the line without counts and brands, and
 * only over aliases that pass sameHeadWord; null below MIN_THRESHOLD. `scored`
 * is every candidate that clears it, best first.
 */
export function fuzzyMatch(
  normalized: string,
  products: Product[],
): { match: { productId: string; confidence: number } | null; scored: Array<{ productId: string; confidence: number }> } {
  const core = fuzzyCore(normalized);
  const scored: Array<{ productId: string; confidence: number }> = [];
  for (const product of products) {
    let best = 0;
    for (const alias of product.normalizedAliases) {
      if (!sameHeadWord(core, alias)) continue;
      const score = diceCoefficient(core, alias);
      if (score > best) best = score;
    }
    if (best >= MIN_THRESHOLD) scored.push({ productId: product.id, confidence: best });
  }
  scored.sort((a, b) => b.confidence - a.confidence);
  return { match: scored[0] ?? null, scored };
}

export const fuzzyMatchLayer: ClassificationLayer = {
  name: "fuzzy",
  acceptThreshold: MIN_THRESHOLD,
  async classify(_rawText, ctx) {
    const { match: top, scored } = fuzzyMatch(ctx.normalized, ctx.products);
    if (!top) return null;

    if (top.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return { productId: top.productId, confidence: top.confidence };
    }

    // Below the high-confidence bar: still return the best guess, but attach
    // the top candidates so the Classification Review screen can let the
    // user confirm or pick a different one instead of silently trusting it.
    return {
      productId: top.productId,
      confidence: top.confidence,
      alternatives: scored.slice(0, MAX_ALTERNATIVES),
    };
  },
};
