import "server-only";
import {
  computeBasketQuotes,
  type BasketRequirement,
  type PricedLine,
} from "@smartroute/core/application/basket/compute-basket-quotes";
import { effectiveVariant } from "@smartroute/core/application/basket/effective-variant";
import { needsVariantChoice } from "@smartroute/core/application/basket/needs-variant-choice";
import type { ShoppingList, ShoppingListItem, ShoppingListItemVariant } from "@smartroute/core/domain/entities/shopping-list";
import { resolveBeforeBranch } from "@smartroute/core/application/classification/resolve-before-branch";
import { classificationService, priceRepository, productRepository } from "@/src/infrastructure/container";
import { MAX_PRICE_FILE_AGE_HOURS } from "@/src/infrastructure/prices/pilot-config";
import { cityName } from "@/src/infrastructure/prices/settlements";
import { shortBranchName } from "@/src/infrastructure/prices/branch-name";
import { dedupeByName, equivalentKeys, scaledFallbacks } from "@/src/infrastructure/prices/sku-equivalence";
import type {
  PriceBranch,
  RequirementKey,
  SkuOption,
} from "@/src/infrastructure/repositories/interfaces/price-repository";

/**
 * Items still to buy: what the comparison is about. Items left unclassified
 * (e.g. classified before the catalog had their product) are re-classified
 * against today's catalog — for this comparison only; the list isn't changed.
 * Comparing chains is the "no branch picked yet" case, so each item reads as
 * it does on the list screen (resolveBeforeBranch): "אורז" is generic rice,
 * not the one chain's private label that also answers to "אורז".
 */
async function openItems(list: ShoppingList): Promise<ShoppingListItem[]> {
  const items = list.items.filter((i) => !i.checked);
  const unclassified = items.filter((i) => !i.classification?.matchedProductId);
  const [results, products] = await Promise.all([
    unclassified.length > 0 ? classificationService.classifyBatch(unclassified.map((i) => i.rawText)) : [],
    productRepository.findAllActive(),
  ]);
  const byId = new Map(unclassified.map((item, idx) => [item.id, results[idx]]));
  return items.map((item) => {
    const fresh = byId.get(item.id);
    const classification = fresh?.matchedProductId ? fresh : item.classification;
    return classification ? { ...item, classification: resolveBeforeBranch(classification, products) } : item;
  });
}

// Enough that a specific product is there to find (the popup searches them).
const MAX_OPTIONS = 60;

export async function variantOptionsFor(list: ShoppingList) {
  const items = await openItems(list);
  const productIds = [...new Set(items.map((i) => i.classification?.matchedProductId).filter((id): id is string => !!id))];
  const options = await priceRepository.findSkuOptions(productIds);
  return items
    .map((item) => {
      const itemOptions = options.get(item.classification?.matchedProductId ?? "") ?? [];
      return { item, itemOptions };
    })
    .filter(({ item, itemOptions }) => needsVariantChoice(item, itemOptions))
    .map(({ item, itemOptions }) => ({
      itemId: item.id,
      rawText: item.rawText,
      productId: item.classification!.matchedProductId!,
      options: dedupeByName(itemOptions).slice(0, MAX_OPTIONS).map((o) => ({
        itemKey: o.itemKey,
        name: o.name,
        label: o.label,
        manufacturer: o.manufacturer,
        isTypical: o.isTypical,
        branchCount: o.branchCount,
      })),
    }));
}

/** Chains don't always flag by-weight items ("פטרוזיליה עלים משקל" is priced per kg). */
const soldByWeight = (o: SkuOption) => o.isWeighted || /(^|\s)ב?משקל(\s|$)/.test(o.name);

type Requirement = BasketRequirement & {
  keys: RequirementKey[];
  chosenKey?: string;
  /** The pick's name from the refinement popup ("שמפו הד אנד שולדרס 400 מל"), for display. */
  chosenName?: string;
};

/**
 * Target-size products first (tier 0); where a branch has none, the same kind
 * in another pack size, priced per unit at the target size (tier 1).
 */
function keysFor(targetKeys: string[], options: SkuOption[]): RequirementKey[] {
  const tier0 = new Set(targetKeys);
  return [
    ...targetKeys.map((itemKey) => ({ itemKey, factor: 1, tier: 0 as const })),
    ...scaledFallbacks(targetKeys, options)
      .filter((f) => !tier0.has(f.itemKey))
      .map((f) => ({ ...f, tier: 1 as const })),
  ];
}

/**
 * List items -> what to price. A chosen product is priced as that kind of
 * product: the pick itself or the cheapest equivalent a branch sells (chains
 * list the same eggs under their own barcodes). Otherwise ("any, cheapest", or
 * nothing chosen yet) the cheapest typical product of the item's generic
 * product. Items with no linked products can't be priced.
 */
function buildRequirements(
  items: ShoppingListItem[],
  options: Map<string, SkuOption[]>,
  overrides: Map<string, ShoppingListItemVariant>,
) {
  const requirements: Requirement[] = [];
  const unpriceable: { itemId: string; rawText: string }[] = [];
  for (const item of items) {
    const override = overrides.get(item.id);
    const variant = override ? effectiveVariant({ ...item, variant: override }) : effectiveVariant(item);
    const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const productOptions = options.get(item.classification?.matchedProductId ?? "") ?? [];
    if (variant?.kind === "sku" && variant.itemKey) {
      requirements.push({
        itemId: item.id,
        rawText: item.rawText,
        quantity,
        estimated: false,
        keys: keysFor([variant.itemKey, ...equivalentKeys(variant.itemKey, productOptions)], productOptions),
        chosenKey: variant.itemKey,
        chosenName: variant.name,
      });
      continue;
    }
    const allTypical = productOptions.filter((o) => o.isTypical);
    if (allTypical.length === 0) {
      unpriceable.push({ itemId: item.id, rawText: item.rawText });
      continue;
    }
    const weighted = allTypical.every(soldByWeight);
    // Sold both ways (parsley as a bunch or by weight, feta packed or at the
    // counter): a per-kg price isn't comparable with a pack's, and counted as
    // one unit it adds ~100₪ to the basket. Compare packs only.
    const typical = weighted ? allTypical : allTypical.filter((o) => !soldByWeight(o));
    requirements.push({
      itemId: item.id,
      rawText: item.rawText,
      // Weighted produce is priced per kg; a list quantity ("3 עגבניות") isn't kilos.
      quantity: weighted ? 1 : quantity,
      estimated: weighted,
      keys: weighted ? typical.map((o) => ({ itemKey: o.itemKey, factor: 1, tier: 0 as const })) : keysFor(typical.map((o) => o.itemKey), productOptions),
    });
  }
  return { requirements, unpriceable };
}

function distanceKm(from: { lat: number; lng: number } | null, branch: PriceBranch): number | null {
  if (!from || branch.lat === null || branch.lng === null) return null;
  const rad = Math.PI / 180;
  const dLat = (branch.lat - from.lat) * rad;
  const dLng = (branch.lng - from.lng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(from.lat * rad) * Math.cos(branch.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export async function quoteBasket(
  list: ShoppingList,
  input: {
    cityCode: number;
    location: { lat: number; lng: number } | null;
    limit: number;
    overrides: Map<string, ShoppingListItemVariant>;
  },
) {
  const items = await openItems(list);
  const branches = (await priceRepository.findBranchesInCity(input.cityCode, MAX_PRICE_FILE_AGE_HOURS)).map((b) => ({
    ...b,
    distanceKm: distanceKm(input.location, b),
  }));
  const productIds = [...new Set(items.map((i) => i.classification?.matchedProductId).filter((id): id is string => !!id))];
  const options = await priceRepository.findSkuOptions(productIds);
  const { requirements, unpriceable } = buildRequirements(items, options, input.overrides);

  const rows = await priceRepository.findCheapestPrices(
    branches.map((b) => b.id),
    requirements.map((r) => ({ id: r.itemId, keys: r.keys })),
  );
  const prices = new Map<number, Map<string, PricedLine>>();
  for (const row of rows) {
    const byItem = prices.get(row.branchId) ?? new Map<string, PricedLine>();
    byItem.set(row.requirementId, {
      itemKey: row.itemKey,
      name: row.name,
      priceAgorot: row.priceAgorot,
      packPriceAgorot: row.packPriceAgorot,
      scaled: row.scaled,
    });
    prices.set(row.branchId, byItem);
  }

  const { quotes, unavailableEverywhere } = computeBasketQuotes({ requirements, branches, prices, limit: input.limit });
  const chosenKeyByItem = new Map(requirements.map((r) => [r.itemId, r.chosenKey]));
  // An item the shopper refined reads as their pick, not as the generic line they typed.
  const chosenNameByItem = new Map(requirements.map((r) => [r.itemId, r.chosenName]));
  const withName = <T extends { itemId: string; rawText: string }>(item: T) => ({
    ...item,
    name: chosenNameByItem.get(item.itemId) ?? item.rawText,
  });
  const city = cityName(input.cityCode);
  return {
    city: { code: input.cityCode, name: city },
    comparedBranchCount: branches.length,
    itemCount: items.length,
    quotes: quotes.map((q) => ({
      branch: {
        id: q.branch.id,
        chainName: q.branch.chainName,
        name: q.branch.name,
        shortName: shortBranchName(q.branch.name, city),
        address: q.branch.address,
        distanceKm: q.branch.distanceKm,
        navioStoreId: q.branch.navioStoreId,
        pricesAt: q.branch.priceFileAt,
      },
      totalAgorot: q.totalAgorot,
      fullBasketAgorot: q.fullBasketAgorot,
      // Lines priced per unit from another pack size are estimates too.
      estimated: q.estimated || q.lines.some((l) => l.scaled),
      missingItems: q.missingItems.map(withName),
      lines: q.lines.map((line) => {
        const chosenKey = chosenKeyByItem.get(line.itemId);
        // Priced with an equivalent of the shopper's pick (another chain's barcode).
        return { ...line, substitute: chosenKey !== undefined && line.itemKey !== chosenKey };
      }),
    })),
    // Not counted against any branch: no linked products, or no branch in the city sells them.
    unpricedItems: [...unpriceable, ...unavailableEverywhere].map(withName),
  };
}
