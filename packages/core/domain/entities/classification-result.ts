import type { ProductCategory } from "./product";

export type ClassificationSource =
  | "dictionary"
  | "normalization"
  /** An alias of products imported from price files - no generic product names the line. */
  | "alias"
  | "fuzzy"
  | "llm"
  | "unresolved";

export interface ClassificationAlternative {
  productId: string;
  confidence: number;
}

export interface ClassificationResult {
  rawText: string;
  matchedProductId?: string;
  /**
   * Set instead of matchedProductId when no generic product names the line but products
   * imported from price files answer to this alias (as written, e.g. "ג'ין") - exactly
   * ("alias") or up to a typo ("fuzzy"). Which of them is meant is decided per branch,
   * when routing; until then the line reads as typed.
   */
  matchedAlias?: string;
  /** With matchedAlias: where the products answering to it stand, for grouping the list. */
  department?: string;
  category?: ProductCategory;
  confidence: number;
  source: ClassificationSource;
  alternativeMatches?: ClassificationAlternative[];
  /** Only meaningful when matchedProductId is set. undefined/true = carried at the requesting
   * store; explicit false = a real catalog product, just not carried at this particular store. */
  availableAtStore?: boolean;
}

/** Whether the line was recognized: as a catalog product, or as an alias of imported ones. */
export function isRecognized(result: ClassificationResult | undefined): boolean {
  return Boolean(result?.matchedProductId || result?.matchedAlias);
}
