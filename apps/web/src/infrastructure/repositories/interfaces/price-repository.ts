/** A generic product's link to one retail SKU, with what the admin review screen shows. */
export interface SkuLinkView {
  itemKey: string;
  name: string;
  manufacturer: string | null;
  variantLabel: string | null;
  source: "rules" | "llm" | "manual" | "trgm";
  isTypical: boolean;
  isRejected: boolean;
  score: number;
  branchCount: number;
  minPriceAgorot: number | null;
  maxPriceAgorot: number | null;
}

export interface IPriceRepository {
  findSkuLinks(productId: string): Promise<SkuLinkView[]>;
  /** An admin decision: marks the link "manual" so the nightly linker never overrides it. */
  updateSkuLink(productId: string, itemKey: string, patch: { isRejected?: boolean; isTypical?: boolean }): Promise<void>;
}
