import { normalizeHebrewText } from "./normalize-hebrew-text";

/**
 * What shoppers type around the product name: "3 חלב", "חלב x2", "שמן 2 ליטר",
 * "קוטג' תנובה 5%". None of it says which product is meant, so classification
 * also tries the line without it (see listLineCores), and a leading count or
 * "x2" becomes the item's quantity (see parseLineQuantity).
 */

// Units and pack words, as they read after normalizeHebrewText ("ק\"ג" -> "ק ג").
const UNIT_WORDS = new Set([
  "קילו", "קילוגרם", "קג", "ליטר", "ליטרים", "גרם", "גרמים", "גר", "מל", "יח", "יחידות", "יחידה",
  "גלילים", "שישיית", "שישייה", "שישיה", "מארז", "חבילה", "חבילת",
]);
// Single letters that are only a unit right after a number ("2 ל", "500 ג", "2 ק ג").
const UNIT_LETTERS = new Set(["ק", "ג", "ל", "מ"]);
const NUMBER_TOKEN = /^(\d+|[x×*]\d+|\d+[x×*]|\d+[x×*]\d+|\d+(קג|ק|ג|גר|גרם|ל|מל|יח))$/;

// Brands written next to a generic product ("פסטה ברילה"): dropped. Only brands
// that don't by themselves name a kind of product - "פריגת תפוזים" is juice, not oranges.
const BRANDS = [
  "תנובה", "שטראוס", "טרה", "יטבתה", "אסם", "עלית", "תלמה", "סוגת", "ברילה", "סטארקיסט", "הלמנס",
  "דנונה", "יד מרדכי", "נסטלה", "ויסוצקי", "וויסוצקי", "זוגלובק", "טירת צבי", "אחלה", "צבר",
  "מחלבות גד", "שופרסל", "רמי לוי", "יוחננוף", "אושר עד", "קרפור", "לילי", "טייסטרס צ'ויס",
].map(normalizeHebrewText);
// Brands that stand for the generic product's name inside a line.
const BRAND_PHRASES: [string, string][] = [
  ["קוקה קולה", "קולה"],
  ["נס קפה", "קפה נמס"],
  ["נסקפה", "קפה נמס"],
].map(([from, to]) => [normalizeHebrewText(from), normalizeHebrewText(to)]);

function replaceWords(text: string, phrase: string, replacement: string): string {
  return ` ${text} `.split(` ${phrase} `).join(` ${replacement} `).replace(/\s+/g, " ").trim();
}

/** The normalized line without counts, sizes and units. */
export function withoutQuantities(normalized: string): string {
  const tokens = normalized.split(" ");
  const kept: string[] = [];
  let afterNumber = false;
  for (const token of tokens) {
    if (NUMBER_TOKEN.test(token) || UNIT_WORDS.has(token) || (afterNumber && UNIT_LETTERS.has(token))) {
      afterNumber = /\d/.test(token) || (afterNumber && UNIT_LETTERS.has(token));
      continue;
    }
    afterNumber = false;
    kept.push(token);
  }
  return kept.join(" ");
}

function withoutBrands(normalized: string): string {
  let text = normalized;
  for (const [from, to] of BRAND_PHRASES) text = replaceWords(text, from, to);
  for (const brand of BRANDS) {
    const next = replaceWords(text, brand, "");
    if (next) text = next;
  }
  return text;
}

/**
 * Progressively cleaner forms of a normalized line to match exactly, most
 * specific first: without counts/units, then without brands, then without a
 * fat % ("קוטג 5%" -> "קוטג", whose options cover every %). Excludes the line itself.
 */
export function listLineCores(normalized: string): string[] {
  const noQuantity = withoutQuantities(normalized);
  const noBrand = withoutBrands(noQuantity || normalized);
  const noPercent = noBrand.split(" ").filter((t) => !/^[\d.]*%$/.test(t)).join(" ");
  return [...new Set([noQuantity, noBrand, noPercent])].filter((v) => v && v !== normalized);
}

/** The cleanest form worth fuzzy-matching: brands and counts can only add noise there. */
export function fuzzyCore(normalized: string): string {
  return withoutBrands(withoutQuantities(normalized) || normalized) || normalized;
}

const UNIT_AFTER_NUMBER = /^(ק"ג|ק״ג|קג|קילו|ליטר|ל'|ל\b|גרם|גר'|גר\b|ג'|ג\b|מ"ל|מ״ל|מל\b|יח|גלילים|מטר)/;

/**
 * A count the shopper typed: a leading number ("3 חלב") unless it's a size
 * ("1 ק\"ג חזה עוף"), or "x2" / "2x" / "×2". A trailing bare number
 * ("ביצים 30") is ambiguous (30 eggs or a 30-tray) and isn't one.
 */
export function parseLineQuantity(rawText: string): number | undefined {
  const text = rawText.trim();
  let quantity: number | undefined;
  const leading = text.match(/^(\d{1,2})\s+(.+)$/);
  if (leading && !UNIT_AFTER_NUMBER.test(leading[2])) quantity = Number(leading[1]);
  const times = text.match(/(?:^|\s)[x×*]\s?(\d{1,2})(?=\s|$)/i) ?? text.match(/(?:^|\s)(\d{1,2})\s?[x×*](?=\s|$)/i);
  if (times) quantity = Number(times[1]);
  return quantity !== undefined && quantity > 1 && quantity <= 30 ? quantity : undefined;
}
