import type { SkuOption } from "./price-repository";

/** Products imported from price files, read by what shoppers type. */
export interface IImportedCatalogRepository {
  /**
   * The barcodes of imported products answering exactly to each normalized text
   * (their name or an alias), for a list line no generic product matches: the
   * cheapest basket prices those instead of leaving the line out.
   */
  skuOptionsByAlias(normalizedTexts: string[]): Promise<Map<string, SkuOption[]>>;
}
