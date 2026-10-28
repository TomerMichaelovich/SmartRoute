import { createHash } from "crypto";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { Product } from "@smartroute/core/domain/entities/product";
import { findShelfGroup, NOT_A_PRODUCT_GROUP } from "@smartroute/core/domain/value-objects/shelf-group";

/**
 * Importing a branch's whole price file as products (scripts/catalog): each barcode
 * becomes one product with a readable name, the names shoppers type for it
 * and the shelf group it stands in. The names/aliases/groups are written offline into
 * enrichment files, one per chunk of items; this module validates those files and
 * decides what to write.
 */

export const MAX_NAME_LENGTH = 60;
export const MAX_ALIASES = 10;

/** One line of a branch's price file, as exported for enrichment. */
export interface BranchItem {
  itemKey: string;
  name: string;
  manufacturer: string | null;
  quantity: number | null;
  unitQty: string | null;
  isWeighted: boolean;
}

/** What enrichment says about one item. */
export interface EnrichedItem {
  itemKey: string;
  name: string;
  aliases: string[];
  group: string;
}

/**
 * One product per barcode, whichever chain's file it came from: the same id on dev and
 * production, and a barcode already imported from one branch is reused by the next.
 * (Chain-internal codes already carry their chain in the item key: "rami-levy:123".)
 */
export function importedProductId(itemKey: string): string {
  return `sku-${createHash("sha1").update(itemKey).digest("hex").slice(0, 16)}`;
}

/** The chain whose price file is imported, for telling its own brand apart. */
export interface ImportChain {
  /** stores.chain_id of the chain's mapped NAVIO stores. */
  navioChainId: string;
  /** The brand name its own-label products carry ("רמי לוי"). */
  brandName: string;
}

/**
 * Most items in a chain's price file are sold at other chains too, so an imported
 * product belongs to no chain. Only the chain's own label - its name says so - is
 * exclusive to it.
 */
export function ownBrandChainId(chain: ImportChain, name: string): string | null {
  return name.includes(chain.brandName) ? chain.navioChainId : null;
}

/**
 * Checks an enrichment file against the chunk it was written for: every item exactly
 * once, a known group, a usable name, and aliases trimmed and de-duplicated (an alias
 * that only repeats the name is dropped). Returns the cleaned items and every problem
 * found; a chunk with problems is not imported.
 */
export function validateEnrichment(
  input: BranchItem[],
  output: unknown,
): { items: EnrichedItem[]; errors: string[] } {
  if (!Array.isArray(output)) return { items: [], errors: ["output is not a JSON array"] };

  const expected = new Set(input.map((item) => item.itemKey));
  const seen = new Set<string>();
  const items: EnrichedItem[] = [];
  const errors: string[] = [];

  for (const [index, raw] of output.entries()) {
    const entry = raw as Partial<Record<keyof EnrichedItem, unknown>> | null;
    const itemKey = typeof entry?.itemKey === "string" ? entry.itemKey : null;
    const where = itemKey ?? `#${index}`;
    if (!itemKey) {
      errors.push(`${where}: missing itemKey`);
      continue;
    }
    if (!expected.has(itemKey)) {
      errors.push(`${where}: not in this chunk`);
      continue;
    }
    if (seen.has(itemKey)) {
      errors.push(`${where}: appears twice`);
      continue;
    }
    seen.add(itemKey);

    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const group = typeof entry?.group === "string" ? entry.group : "";
    const rawAliases = Array.isArray(entry?.aliases) ? entry.aliases : null;
    const problems: string[] = [];
    if (!name) problems.push("empty name");
    else if (name.length > MAX_NAME_LENGTH) problems.push(`name longer than ${MAX_NAME_LENGTH}`);
    if (!findShelfGroup(group)) problems.push(`unknown group "${group}"`);
    if (!rawAliases || rawAliases.some((alias) => typeof alias !== "string")) problems.push("aliases is not a list of strings");

    const aliases: string[] = [];
    const taken = new Set([normalizeHebrewText(name)]);
    for (const alias of (rawAliases ?? []) as string[]) {
      const trimmed = alias.trim();
      const normalized = normalizeHebrewText(trimmed);
      if (!normalized || taken.has(normalized)) continue;
      taken.add(normalized);
      aliases.push(trimmed);
    }
    if (group !== NOT_A_PRODUCT_GROUP && rawAliases && aliases.length === 0) problems.push("no aliases");
    if (aliases.length > MAX_ALIASES) problems.push(`more than ${MAX_ALIASES} aliases`);

    if (problems.length > 0) errors.push(`${where}: ${problems.join(", ")}`);
    else items.push({ itemKey, name, aliases, group });
  }

  for (const itemKey of expected) {
    if (!seen.has(itemKey)) errors.push(`${itemKey}: missing from output`);
  }
  return { items, errors };
}

/** The product an enriched item becomes; department and category come from its group. */
export function buildImportedProduct(chain: ImportChain, item: EnrichedItem): Product {
  const group = findShelfGroup(item.group);
  if (!group) throw new Error(`unknown group "${item.group}" for ${item.itemKey}`);
  return {
    id: importedProductId(item.itemKey),
    canonicalName: item.name,
    aliases: item.aliases,
    normalizedAliases: [...new Set([item.name, ...item.aliases].map(normalizeHebrewText))],
    category: group.category,
    department: group.department,
    isActive: true,
    chainId: ownBrandChainId(chain, item.name),
    sourceItemKey: item.itemKey,
    shelfGroup: group.id,
    manuallyEdited: false,
  };
}

/** An already imported product, as much as syncing needs. */
export interface ImportedProduct {
  id: string;
  sourceItemKey: string;
  isActive: boolean;
  manuallyEdited: boolean;
}

export interface CatalogSyncPlan {
  /** New products, and enriched ones not edited by an admin (name, aliases, group refreshed). */
  upsert: Product[];
  /** Admin-edited products back in the price file: only switched back on. */
  reactivate: string[];
  /** Imported products no price file carries any more, or now known not to be products. */
  deactivate: string[];
  /** Barcodes in the price file with no enrichment yet - export and enrich them. */
  notEnriched: string[];
}

/**
 * What importing one branch's price file writes. Its items are switched on and, unless
 * an admin edited them, take their names and groups from enrichment. A product is only
 * switched off once no price file carries it (`stillSold`) - leaving this branch's file
 * says nothing about other branches and chains. Nothing is deleted, so map placements
 * survive a barcode's absence.
 */
export function planCatalogSync(
  chain: ImportChain,
  existing: ImportedProduct[],
  branchItemKeys: Iterable<string>,
  enriched: Map<string, EnrichedItem>,
  stillSold: Set<string>,
): CatalogSyncPlan {
  const byKey = new Map(existing.map((product) => [product.sourceItemKey, product]));
  const inFile = new Set(branchItemKeys);
  const plan: CatalogSyncPlan = { upsert: [], reactivate: [], deactivate: [], notEnriched: [] };

  for (const itemKey of inFile) {
    const current = byKey.get(itemKey);
    const item = enriched.get(itemKey);
    if (item?.group === NOT_A_PRODUCT_GROUP) {
      if (current?.isActive) plan.deactivate.push(current.id);
      continue;
    }
    if (current?.manuallyEdited) {
      if (!current.isActive) plan.reactivate.push(current.id);
      continue;
    }
    if (item) plan.upsert.push(buildImportedProduct(chain, item));
    else if (current) {
      if (!current.isActive) plan.reactivate.push(current.id);
    } else plan.notEnriched.push(itemKey);
  }

  for (const product of existing) {
    if (product.isActive && !inFile.has(product.sourceItemKey) && !stillSold.has(product.sourceItemKey)) {
      plan.deactivate.push(product.id);
    }
  }
  return plan;
}
