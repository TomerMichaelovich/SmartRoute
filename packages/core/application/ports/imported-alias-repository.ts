import type { ImportedAliasIndex } from "../classification/imported-aliases";

export interface IImportedAliasRepository {
  /** Every alias of the active products imported from price files, indexed for classification. */
  aliasIndex(): Promise<ImportedAliasIndex>;
}
