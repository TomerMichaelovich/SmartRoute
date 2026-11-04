import type { ClassificationSource } from "@smartroute/core/domain/entities/classification-result";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { AliasHit, ImportedAliasIndex } from "./imported-aliases";

/** A catalog product (productId) - or, when no generic product names the line, an alias of imported ones. */
export type LayerMatch =
  | { productId: string; alias?: undefined; confidence: number; alternatives?: Array<{ productId: string; confidence: number }> }
  | { productId?: undefined; alias: AliasHit; confidence: number; alternatives?: undefined };

export interface ClassificationLayerContext {
  normalized: string;
  products: Product[];
  /** The aliases of products imported from price files; absent where they aren't loaded (on the device). */
  aliases?: ImportedAliasIndex;
}

export interface ClassificationLayer {
  name: ClassificationSource;
  acceptThreshold: number;
  classify(rawText: string, ctx: ClassificationLayerContext): Promise<LayerMatch | null>;
}
