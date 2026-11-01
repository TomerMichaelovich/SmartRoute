import type { ProductCategory } from "@smartroute/core/domain/entities/product";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { diceCoefficient } from "./dice-coefficient";
import { contentWords, headOf, sameHeadWord, similarWords } from "./head-word";
import { fuzzyCore, listLineCores } from "./list-line";
import { normalizeHebrewText } from "./normalize-hebrew-text";

/**
 * What shoppers write for the products imported from price files - each one's aliases
 * ("ג'ין", "בילואו", "יוגורט תות") - so classification recognizes a line that no generic
 * product names. It doesn't pick one of them: which is meant is a branch's question,
 * answered when routing (place-choice) and pricing (the basket's line options).
 */

/** One alias as stored, with the shelf group of products carrying it and how many do. */
export interface ImportedAliasRow {
  alias: string;
  shelfGroup: string;
  products: number;
}

export interface AliasHit {
  /** The alias as written ("ג'ין"). */
  text: string;
  department?: string;
  category?: ProductCategory;
}

export interface ImportedAliasIndex {
  /** Normalized alias -> the alias. */
  exact: Map<string, AliasHit>;
  /** Content word -> normalized aliases containing it, for finding close spellings fast. */
  byWord: Map<string, string[]>;
}

/**
 * The forms a line may take for an alias: normalizing turns a geresh into a space
 * ("ג'ין" -> "ג ין"), which a shopper writing "גין" doesn't type.
 */
function aliasKeys(alias: string): string[] {
  return [...new Set([normalizeHebrewText(alias), normalizeHebrewText(alias.replace(/['׳"״]/g, ""))])].filter(Boolean);
}

export function buildAliasIndex(rows: ImportedAliasRow[]): ImportedAliasIndex {
  // The group most of the alias's products stand in says where the line belongs.
  const best = new Map<string, { row: ImportedAliasRow; products: number }>();
  for (const row of rows) {
    for (const key of aliasKeys(row.alias)) {
      const current = best.get(key);
      if (!current || row.products > current.products) best.set(key, { row, products: row.products });
    }
  }
  const exact = new Map<string, AliasHit>();
  const byWord = new Map<string, string[]>();
  for (const [key, { row }] of best) {
    const group = findShelfGroup(row.shelfGroup);
    exact.set(key, { text: row.alias, department: group?.department, category: group?.category });
    for (const word of new Set(contentWords(key))) {
      const keys = byWord.get(word);
      if (keys) keys.push(key);
      else byWord.set(word, [key]);
    }
  }
  return { exact, byWord };
}

/** The alias the line names exactly, as typed or without counts, units and brands ("2 ג'ין"). */
export function exactAliasMatch(normalized: string, index: ImportedAliasIndex): AliasHit | null {
  for (const text of [normalized, ...listLineCores(normalized)]) {
    const hit = index.exact.get(text);
    if (hit) return hit;
  }
  return null;
}

/**
 * The closest alias up to a typo ("במבע" -> "במבה"), by the fuzzy layer's rules: the head
 * nouns must agree (sameHeadWord), then bigram similarity of at least `minScore`. Only
 * aliases sharing a word close to the line's head word are scored.
 */
export function fuzzyAliasMatch(
  normalized: string,
  index: ImportedAliasIndex,
  minScore: number,
): { hit: AliasHit; confidence: number } | null {
  const core = fuzzyCore(normalized);
  const head = headOf(contentWords(core));
  if (!head) return null;
  const candidates = new Set<string>();
  for (const [word, keys] of index.byWord) {
    if (Math.abs(word.length - head.length) > 2 || !similarWords(head, word)) continue;
    for (const key of keys) candidates.add(key);
  }
  let best: { key: string; confidence: number } | null = null;
  for (const key of candidates) {
    if (!sameHeadWord(core, key)) continue;
    const confidence = diceCoefficient(core, key);
    if (confidence >= minScore && (!best || confidence > best.confidence)) best = { key, confidence };
  }
  return best ? { hit: index.exact.get(best.key)!, confidence: best.confidence } : null;
}
