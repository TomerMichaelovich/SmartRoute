function bigrams(s: string): string[] {
  const compact = s.replace(/\s+/g, "");
  if (compact.length < 2) return compact.length === 1 ? [compact] : [];
  const grams: string[] = [];
  for (let i = 0; i < compact.length - 1; i++) {
    grams.push(compact.slice(i, i + 2));
  }
  return grams;
}

/**
 * Sorensen-Dice coefficient over character bigrams: 2x bigram overlap /
 * total bigram count. Chosen over Levenshtein for short Hebrew grocery
 * strings because it's cheap (no DP matrix) and tolerant of word-order
 * variation (bigram sets, not positional edits).
 */
export function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const remaining = new Map<string, number>();
  for (const g of bigramsA) remaining.set(g, (remaining.get(g) ?? 0) + 1);

  let intersection = 0;
  for (const g of bigramsB) {
    const count = remaining.get(g) ?? 0;
    if (count > 0) {
      intersection += 1;
      remaining.set(g, count - 1);
    }
  }

  return (2 * intersection) / (bigramsA.length + bigramsB.length);
}
