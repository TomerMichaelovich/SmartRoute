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
  /** The price used for the comparison: the shelf price times the key's factor. */
  priceAgorot: number;
  /** The shelf price of the product actually found. */
  packPriceAgorot: number;
  /** Found only as another pack size, priced per unit (factor != 1). */
  scaled: boolean;
}

/** An acceptable product for a requirement. Tier 0 keys win over tier 1 wherever a branch has one. */
export interface RequirementKey {
  itemKey: string;
  /** Multiplies the shelf price (e.g. 12/18 to price an 18-egg tray as 12 eggs). */
  factor: number;
  tier: 0 | 1;
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
  /**
   * For each branch and requirement, the best acceptable SKU it sells: the
   * lowest tier available there, then the lowest price after the key's factor.
   */
  findCheapestPrices(branchIds: number[], requirements: { id: string; keys: RequirementKey[] }[]): Promise<CheapestPriceRow[]>;
}
