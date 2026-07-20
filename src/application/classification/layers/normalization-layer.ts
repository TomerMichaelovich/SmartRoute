import type { ClassificationLayer } from "../classification-layer.interface";
import { normalizeHebrewText } from "../normalize-hebrew-text";

/**
 * Colloquial/brand substitutions that aren't simple string edits, e.g. a brand
 * name that should resolve to the generic product it's colloquially used for.
 */
const SYNONYMS: Record<string, string> = {
  "קוקה קולה": "קולה",
  קוק: "קולה",
  תפוד: "תפוח אדמה",
  תפודים: "תפוחי אדמה",
};

const BOUND_PREFIXES = ["ה", "ו", "ב", "ל", "מ"];

/** Candidate rewrites of `normalized` worth re-checking against the exact-match corpus. */
function candidateVariants(normalized: string): string[] {
  const variants = new Set<string>();

  const synonym = SYNONYMS[normalized];
  if (synonym) variants.add(normalizeHebrewText(synonym));

  for (const prefix of BOUND_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 1) {
      variants.add(normalized.slice(prefix.length));
    }
  }

  if (normalized.endsWith("ים") && normalized.length > 3) {
    variants.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("ות") && normalized.length > 3) {
    variants.add(normalized.slice(0, -2));
  }

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
