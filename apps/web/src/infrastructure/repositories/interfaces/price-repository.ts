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

/** One option of the refinement popup: a SKU a shopper could mean by a generic product. */
export interface SkuOption {
  itemKey: string;
  name: string;
  label: string | null;
  manufacturer: string | null;
  isTypical: boolean;
  isWeighted: boolean;
  branchCount: number;
}

/** A retail branch that takes part in price comparison. */
export interface PriceBranch {
  id: number;
  chainId: string;
  chainName: string;
  name: string;
  address: string | null;
  cityCode: number;
  lat: number | null;
  lng: number | null;
  navioStoreId: string | null;
  /** When the branch's newest price file was published (Israel time). */
  priceFileAt: string;
}

export interface CheapestPriceRow {
  branchId: number;
  requirementId: string;
  itemKey: string;
  name: string;
  priceAgorot: number;
}

export interface IPriceRepository {
  findSkuLinks(productId: string): Promise<SkuLinkView[]>;
  /** An admin decision: marks the link "manual" so the nightly linker never overrides it. */
  updateSkuLink(productId: string, itemKey: string, patch: { isRejected?: boolean; isTypical?: boolean }): Promise<void>;

  /** Linked (not rejected) SKUs per product, most widely carried first. */
  findSkuOptions(productIds: string[]): Promise<Map<string, SkuOption[]>>;
  /** CBS city codes with price-enabled retail branches, and how many. */
  findPriceCities(): Promise<{ cityCode: number; branchCount: number }[]>;
  /** Retail branches of a city whose prices are fresh enough to compare. */
  findBranchesInCity(cityCode: number, maxPriceAgeHours: number): Promise<PriceBranch[]>;
  /** For each branch and requirement, the cheapest of the requirement's acceptable SKUs it sells. */
  findCheapestPrices(
    branchIds: number[],
    requirements: { id: string; itemKeys: string[] }[],
  ): Promise<CheapestPriceRow[]>;
}
