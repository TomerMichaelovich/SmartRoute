export type ClassificationSource =
  | "dictionary"
  | "normalization"
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
  confidence: number;
  source: ClassificationSource;
  alternativeMatches?: ClassificationAlternative[];
  /** Only meaningful when matchedProductId is set. undefined/true = carried at the requesting
   * store; explicit false = a real catalog product, just not carried at this particular store. */
  availableAtStore?: boolean;
}
