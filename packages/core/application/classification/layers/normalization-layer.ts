import type { ClassificationLayer } from "../classification-layer.interface";
import { listLineCores } from "../list-line";
import { normalizeHebrewText } from "../normalize-hebrew-text";

/**
 * Colloquial/brand substitutions that aren't simple string edits, e.g. a brand
 * name that should resolve to the generic product it's colloquially used for.
 */
const SYNONYMS: Record<string, string> = Object.fromEntries(
  Object.entries({
    "קוקה קולה": "קולה",
    קוק: "קולה",
    תפוד: "תפוח אדמה",
    תפודים: "תפוחי אדמה",
    פיירי: "סבון כלים",
    קולגייט: "משחת שיניים",
    האגיס: "חיתולים",
    פמפרס: "חיתולים",
    "חלב שוקו": "שוקו",
    מילקי: "מעדן",
    דני: "מעדן",
    "ז'אוול": "אקונומיקה",
    "סנו ז'אוול": "אקונומיקה",
  }).map(([from, to]) => [normalizeHebrewText(from), normalizeHebrewText(to)]),
);

const BOUND_PREFIXES = ["ה", "ו", "ב", "ל", "מ"];

function rewrites(text: string, variants: Set<string>): void {
  const synonym = SYNONYMS[text];
  if (synonym) variants.add(synonym);

  for (const prefix of BOUND_PREFIXES) {
    if (text.startsWith(prefix) && text.length > prefix.length + 1) {
      variants.add(text.slice(prefix.length));
    }
  }

  if (text.endsWith("ים") && text.length > 3) {
    variants.add(text.slice(0, -2));
  }
  if (text.endsWith("ות") && text.length > 3) {
    variants.add(text.slice(0, -2));
  }
}

/**
 * Candidate rewrites of `normalized` worth re-checking against the exact-match
 * corpus: the line itself rewritten, then the line without counts, units and
 * brands ("3 חלב", "פסטה ברילה"), as is and rewritten.
 */
function candidateVariants(normalized: string): string[] {
  const variants = new Set<string>();
  rewrites(normalized, variants);
  for (const core of listLineCores(normalized)) {
    variants.add(core);
    rewrites(core, variants);
  }
  variants.delete(normalized);
  return Array.from(variants);
}

/**
 * Applies synonym/prefix/suffix rewrites and re-attempts an exact match.
 * A rewrite is only ever surfaced if it lands on a real catalog entry - this
 * is what keeps prefix/suffix stripping safe against mangling real product
 * names that legitimately start or end with those letters.
 */
export const normalizationLayer: ClassificationLayer = {
  name: "normalization",
  acceptThreshold: 0.9,
  async classify(_rawText, ctx) {
    for (const variant of candidateVariants(ctx.normalized)) {
      for (const product of ctx.products) {
        if (product.normalizedAliases.includes(variant)) {
          return { productId: product.id, confidence: 0.9 };
        }
      }
    }
    return null;
  },
};
