import type {
  CatalogSummaryEntry,
  ILLMClassifier,
  LLMClassificationResult,
} from "./llm-classifier.interface";

/**
 * Stub: no ANTHROPIC_API_KEY is wired up yet (deliberate MVP scoping decision -
 * see plan). Always reports "no match" so the classification pipeline's cache
 * still marks the string unresolved rather than leaving it unhandled. Swap the
 * body for a real @anthropic-ai/sdk call when the key is available; no other
 * file needs to change since callers only depend on ILLMClassifier.
 */
export class AnthropicClassifier implements ILLMClassifier {
  async classifyProduct(
    _rawText: string,
    _catalogSummary: CatalogSummaryEntry[],
  ): Promise<LLMClassificationResult> {
    return { confidence: 0 };
  }
}
