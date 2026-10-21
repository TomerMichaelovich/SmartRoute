import { normalizeRetailName } from "./ingest";
import { wordVariants, type ScoredCandidate } from "./sku-candidates";
import type { SkuVerdict } from "./sku-verifier";

/**
 * Rule-based verification of SKU candidates — the free alternative to the
 * Claude verifier (sku-verifier.ts), used until an API key is available.
 * Stricter than Claude would be: it misses some valid links and lets a few
 * wrong ones through; the admin review screen fixes those by hand.
 */

// Words that turn a product into a different one: "עגבניות מרוסקות" isn't
// tomatoes, "שוקולד חלב" isn't milk. Ignored when the product's own name uses
// the word ("רסק עגבניות", "חלב סויה").
const DERIVED_WORDS = [
  "מרוסקות", "מרוסק", "קצוצות", "קצוץ", "חתוכות", "רסק", "רוטב", "ברוטב", "שימורים", "בשימורים",
  "משומרות", "מיובשות", "מיובש", "אבקה", "אבקת", "ממרח", "בטעם", "טעם", "משקה", "חטיף", "שוקולד",
  "קרם", "תרכיז", "סירופ", "מחית", "פולפה", "מוקפא", "מוקפאים", "קפוא", "קפואה", "קפואים", "קפואות",
  "מבושל", "מטוגן", "צלוי", "ממולא", "ממולאים", "סלט", "מרק", "פריכיות", "עוגיות", "עוגת", "גלידה",
  "יוגורט", "פודינג", "מעדן", "ריבה", "קוקוס", "שקדים", "סויה", "שיבולת", "שמפו", "סבון", "נרות",
  "תבלין", "ציפוי", "מצופה", "פתיתי",
];

// Variants that make an option non-standard: not what "any, cheapest" should pick.
const NON_STANDARD_WORDS = [
  "בטעם", "במילוי", "מילוי", "וניל", "שוקו", "תות", "בננה", "נוגט", "ברביקיו", "אורגני", "אורגנית",
  "אורגניות", "מיני", "לייט", "דיאט", "זירו", "מארז", "ללא", "נטול", "נטו", "דל", "מועשר", "קפה",
];

const PRODUCE_DEPARTMENT = "ירקות ופירות";

type Size = { amount: number; base: "ml" | "g" | "unit" };

/** "1 ליטר" / "500 גרם" in a canonical name -> base units. */
function sizeFromName(normalizedName: string): Size | null {
  // Normalization turns מ"ל / ק"ג into "מ ל" / "ק ג".
  const m = normalizedName.match(/(\d+(?:\.\d+)?)\s*(ליטר|מ ?ל|מיליליטר|ל|גרם|גר|ק ?ג|קילו|ג|יחידות|יח)(?:\s|$)/);
  if (!m) return null;
  return toBase(Number(m[1]), m[2]);
}

function toBase(amount: number, unit: string): Size | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/^(ליטר|ל|ליטרים)$/.test(unit)) return { amount: amount * 1000, base: "ml" };
  if (/^(מ ?ל|מיליליטר|מ"ל)$/.test(unit) || unit.includes("מיליליטר")) return { amount, base: "ml" };
  if (/^(ק ?ג|קילו|קילוגרם|ק"ג)$/.test(unit) || unit.includes("קילוגרם")) return { amount: amount * 1000, base: "g" };
  if (/^(גרם|גר|ג)$/.test(unit) || unit.includes("גרם")) return { amount, base: "g" };
  if (/^(יח|יחידות|יחידה)$/.test(unit) || unit.includes("יחיד")) return { amount, base: "unit" };
  return null;
}

function candidateSize(c: ScoredCandidate): Size | null {
  if (c.quantity && c.unitQty) {
    const size = toBase(c.quantity, c.unitQty.trim());
    if (size) return size;
  }
  return sizeFromName(c.normalizedName);
}

const percentOf = (normalizedName: string) => normalizedName.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? null;

function cleanManufacturer(m: string | null): string | null {
  if (!m) return null;
  const cleaned = m.replace(/בע"?מ|בעמ|ltd\.?|s\.?p\.?a\.?|[.,]/gi, "").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned === "כללי") return null;
  return cleaned.split(" ").slice(0, 2).join(" ");
}

/** The name minus the generic term ("חלב"), plus the brand when the name lacks it. */
function labelFor(c: ScoredCandidate, genericWords: Set<string>): string {
  const spaced = c.name.replace(/([א-ת])(\d)/g, "$1 $2").replace(/([\d%])([א-ת])/g, "$1 $2");
  const rest = spaced
    .split(/\s+/)
    .filter((w) => w && !genericWords.has(normalizeRetailName(w)))
    .join(" ")
    .trim();
  const brand = cleanManufacturer(c.manufacturer);
  const withBrand = brand && !c.name.includes(brand.split(" ")[0]) ? `${rest}${rest ? " · " : ""}${brand}` : rest;
  return (withBrand || c.name).slice(0, 40);
}

const isNumericWord = (w: string) => /^[\d.%]+$/.test(w) || /^(ליטר|ל|מ|גרם|גר|ג|ק|קג|יח|יחידות|מל)$/.test(w);

export interface RulesProduct {
  canonicalName: string;
  normalizedAliases: string[];
  department: string;
}

/**
 * @param moreSpecificElsewhere item keys another product matches through a
 *   longer alias ("עגבניות שרי" for the product "עגבניות שרי") — fine as options
 *   for "עגבניות", but not its typical pick.
 */
export function verifySkuCandidatesByRules(
  product: RulesProduct,
  candidates: ScoredCandidate[],
  moreSpecificElsewhere: (itemKey: string, matchedWords: number) => boolean = () => false,
): SkuVerdict[] {
  const aliasWords = new Set(
    product.normalizedAliases.flatMap((a) => normalizeRetailName(a).split(" ")).flatMap(wordVariants),
  );
  // The shortest alias is the generic term a shopper writes ("חלב").
  const genericTerm = [...product.normalizedAliases].sort((a, b) => a.length - b.length)[0] ?? product.canonicalName;
  const genericWords = new Set(normalizeRetailName(genericTerm).split(" ").flatMap(wordVariants));
  const canonical = normalizeRetailName(product.canonicalName);
  const wantedPercent = percentOf(canonical);
  const wantedSize = sizeFromName(canonical);
  // Words the canonical name adds beyond the generic term ("לחם אחיד פרוס" -> אחיד, פרוס),
  // except numbers/units (checked above) and brands (any brand is fine for "any, cheapest").
  const brandWords = new Set(
    candidates.flatMap((c) => (c.manufacturer ? normalizeRetailName(c.manufacturer).split(" ") : [])),
  );
  const requiredWords = canonical
    .split(" ")
    .filter((w) => w && !genericWords.has(w) && !isNumericWord(w) && !brandWords.has(w))
    .map(wordVariants);
  const isProduce = product.department === PRODUCE_DEPARTMENT;

  const verdicts = candidates.map((c) => {
    const words = new Set(c.normalizedName.split(" "));
    const derived = DERIVED_WORDS.some((w) => words.has(w) && !aliasWords.has(w));
    // Multipacks of cans ("3*400ג") in a produce product are preserves, not produce.
    const preserved = isProduce && !c.isWeighted && /\d\s*\*|\*\s*\d/.test(c.name);
    const match = c.startsWithAlias && !c.viaFallback && !derived && !preserved;

    let typical = false;
    if (match) {
      const nonStandard = NON_STANDARD_WORDS.some((w) => words.has(w) && !aliasWords.has(w));
      const percentOk = !wantedPercent || percentOf(c.normalizedName) === wantedPercent;
      const size = candidateSize(c);
      const sizeOk =
        !wantedSize ||
        (size !== null && size.base === wantedSize.base && Math.abs(size.amount - wantedSize.amount) <= wantedSize.amount * 0.15);
      const wordsOk = requiredWords.every((variants) => variants.some((v) => words.has(v)));
      typical = !nonStandard && percentOk && sizeOk && wordsOk;
    }
    return { itemKey: c.itemKey, match, typical, label: labelFor(c, genericWords), c };
  });

  const typicals = () => verdicts.filter((v) => v.typical);
  // Never mix per-kg and per-pack prices in "any, cheapest": weighted wins when present.
  if (typicals().some((v) => v.c.isWeighted)) for (const v of typicals()) if (!v.c.isWeighted) v.typical = false;
  // Leave items another product claims more specifically to that product — if anything remains.
  const own = typicals().filter((v) => !moreSpecificElsewhere(v.itemKey, v.c.matchedWords));
  if (own.length) for (const v of typicals()) if (!own.includes(v)) v.typical = false;
  // "Any, cheapest" needs something to pick from: fall back to the best matches.
  if (!typicals().length) {
    verdicts
      .filter((v) => v.match)
      .sort((a, b) => b.c.score - a.c.score)
      .slice(0, 3)
      .forEach((v) => (v.typical = true));
  }
  return verdicts.map((v) => ({ itemKey: v.itemKey, match: v.match, typical: v.typical, label: v.label }));
}
