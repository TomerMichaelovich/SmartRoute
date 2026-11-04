/**
 * Whether two texts name the same kind of thing, by their head nouns - what fuzzy
 * matching is allowed to look past (a typo) and what not (a different noun).
 */

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

export const contentWords = (text: string) =>
  text
    .split(" ")
    .filter((w) => w.length >= 2 && !/\d/.test(w))
    .map((w) => w.replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c]));

export const headOf = (words: string[]) => words.find((w) => !QUALIFIERS.has(w)) ?? words[0];

/** Equal up to a typo: none for short words, one letter up to 6, two beyond. */
export function similarWords(a: string, b: string): boolean {
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
