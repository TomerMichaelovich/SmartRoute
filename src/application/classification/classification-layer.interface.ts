import type { ClassificationSource } from "@/src/domain/entities/classification-result";
import type { Product } from "@/src/domain/entities/product";

export interface LayerMatch {
  productId: string;
  confidence: number;
  alternatives?: Array<{ productId: string; confidence: number }>;
}

export interface ClassificationLayerContext {
  normalized: string;
  products: Product[];
}

export interface ClassificationLayer {
  name: ClassificationSource;
  acceptThreshold: number;
  classify(rawText: string, ctx: ClassificationLayerContext): Promise<LayerMatch | null>;
}
