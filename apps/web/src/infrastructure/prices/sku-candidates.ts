import { normalizeRetailName } from "./ingest";

/**
 * Candidate retail SKUs for a generic product ("חלב" -> "חלב תנובה 3% 1 ל'", ...).
 * Deliberately broad: every word of an alias must appear as a whole word in the
 * SKU name, so "חלבה" never matches "חלב" — but "שוקולד חלב" still does, which
 * is why every candidate is then verified (link-skus) before it's offered.
 */

export interface CandidateItem {
  id: number;
  itemKey: string;
  name: string;
  normalizedName: string;
  manufacturer: string | null;
  quantity: number | null;
  unitQty: string | null;
  isWeighted: boolean;
  branchCount: number;
}

export interface ScoredCandidate extends CandidateItem {
  /** The alias's first word opens the name ("חלב 3% ..."), the strongest signal. */
  startsWithAlias: boolean;
  /** Found only through the head-word fallback: not every alias word is in the name. */
  viaFallback: boolean;
  /** Word count of the alias that matched — "עגבניות שרי" (2) is more specific than "עגבניות" (1). */
  matchedWords: number;
  score: number;
}

// Words retail names use interchangeably.
const WORD_SYNONYMS: Record<string, string[]> = {
  ללא: ["נטול", "נטו"],
  נטול: ["ללא", "נטו"],
  אחוז: ["%"],
};

/** Singular/plural spellings of one word: עגבניות <-> עגבניה, מלפפונים <-> מלפפון. */
export function wordVariants(word: string): string[] {
  const variants = new Set([word, ...(WORD_SYNONYMS[word] ?? [])]);
  if (word.length >= 4 && /^[א-ת]+$/.test(word)) {
    if (word.endsWith("ות")) {
      const stem = word.slice(0, -2);
      variants.add(`${stem}ה`);
      variants.add(`${stem}ת`);
    } else if (word.endsWith("ים")) {
      variants.add(word.slice(0, -2));
    } else if (word.endsWith("ה")) {
      variants.add(`${word.slice(0, -1)}ות`);
    } else {
      variants.add(`${word}ים`);
    }
  }
  return [...variants];
}

type AliasPattern = string[][]; // per alias word, its accepted spellings

function toPattern(alias: string): AliasPattern {
  return normalizeRetailName(alias)
    .split(" ")
    .filter(Boolean)
    .map(wordVariants);
}

function matchPattern(words: string[], wordSet: Set<string>, pattern: AliasPattern) {
  if (!pattern.every((variants) => variants.some((v) => wordSet.has(v)))) return null;
  return { starts: pattern[0].includes(words[0]) };
}

export function findSkuCandidates(
  normalizedAliases: string[],
  items: CandidateItem[],
  limit = 60,
): ScoredCandidate[] {
  const patterns = [...new Set(normalizedAliases)].map(toPattern).filter((p) => p.length > 0 && p.join("").length >= 2);
  const score = (item: CandidateItem, starts: boolean, aliasWords: number, weight: number) => {
    const extraWords = Math.max(0, item.normalizedName.split(" ").length - aliasWords);
    // Name position dominates; short names ("עגבניה") rank above long ones
    // ("עגבניות מרוסקות 800 ג יכין"); within that, what more branches carry.
    return weight * ((starts ? 2 : 1) * Math.log(2 + item.branchCount) + (starts ? 3 / (1 + extraWords) : 0));
  };

  const collect = (pats: AliasPattern[], weight: number) => {
    const out = new Map<number, ScoredCandidate>();
    for (const item of items) {
      const words = item.normalizedName.split(" ");
      const wordSet = new Set(words);
      for (const p of pats) {
        const m = matchPattern(words, wordSet, p);
        if (!m) continue;
        const s = score(item, m.starts, p.length, weight);
        const prev = out.get(item.id);
        const matchedWords = Math.max(prev?.matchedWords ?? 0, m.starts ? p.length : 0);
        if (!prev || s > prev.score) {
          out.set(item.id, { ...item, startsWithAlias: m.starts, viaFallback: weight < 1, matchedWords, score: s });
        } else {
          prev.matchedWords = matchedWords;
        }
      }
    }
    return out;
  };

  const found = collect(patterns, 1);
  // Too specific to find anything ("חלב ללא לקטוז" vs "חלב נטול לקטוז מועשר")?
  // Fall back to the aliases' head word, scored lower; verification sorts it out.
  if (found.size < 3) {
    const heads = patterns.filter((p) => p.length > 1).map((p) => [p[0]]);
    for (const [id, c] of collect(heads, 0.5)) if (!found.has(id) && c.startsWithAlias) found.set(id, c);
  }
  return [...found.values()].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "he")).slice(0, limit);
}
