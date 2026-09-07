export interface CatalogSummaryEntry {
  id: string;
  canonicalName: string;
  category: string;
  department: string;
}

export interface LLMClassificationResult {
  productId?: string;
  confidence: number;
  reasoning?: string;
}

export interface ILLMClassifier {
  classifyProduct(
    rawText: string,
    catalogSummary: CatalogSummaryEntry[],
  ): Promise<LLMClassificationResult>;
}
