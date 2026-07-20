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
}
