import "server-only";
import {
  computeBasketQuotes,
  type BasketRequirement,
  type PricedLine,
} from "@smartroute/core/application/basket/compute-basket-quotes";
import { effectiveVariant } from "@smartroute/core/application/basket/effective-variant";
import { needsVariantChoice } from "@smartroute/core/application/basket/needs-variant-choice";
import type { ShoppingList, ShoppingListItem, ShoppingListItemVariant } from "@smartroute/core/domain/entities/shopping-list";
import { classificationService, priceRepository } from "@/src/infrastructure/container";
import { MAX_PRICE_FILE_AGE_HOURS } from "@/src/infrastructure/prices/pilot-config";
import { cityName } from "@/src/infrastructure/prices/settlements";
import { shortBranchName } from "@/src/infrastructure/prices/branch-name";
import { dedupeByName, equivalentKeys } from "@/src/infrastructure/prices/sku-equivalence";
import type { PriceBranch, SkuOption } from "@/src/infrastructure/repositories/interfaces/price-repository";

/**
 * Items still to buy: what the comparison is about. Items left unclassified
 * (e.g. classified before the catalog had their product) are re-classified
 * against today's catalog — for this comparison only; the list isn't changed.
 */
async function openItems(list: ShoppingList): Promise<ShoppingListItem[]> {
  const items = list.items.filter((i) => !i.checked);
  const unclassified = items.filter((i) => !i.classification?.matchedProductId);
  if (unclassified.length === 0) return items;
  const results = await classificationService.classifyBatch(unclassified.map((i) => i.rawText));
  const byId = new Map(unclassified.map((item, idx) => [item.id, results[idx]]));
  return items.map((item) => {
    const result = byId.get(item.id);
    return result?.matchedProductId ? { ...item, classification: result } : item;
  });
}

const MAX_OPTIONS = 12;

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

type Requirement = BasketRequirement & { itemKeys: string[]; chosenKey?: string };

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
        itemKeys: [variant.itemKey, ...equivalentKeys(variant.itemKey, productOptions)],
        chosenKey: variant.itemKey,
      });
      continue;
    }
    const typical = productOptions.filter((o) => o.isTypical);
    if (typical.length === 0) {
      unpriceable.push({ itemId: item.id, rawText: item.rawText });
      continue;
    }
    const weighted = typical.every((o) => o.isWeighted);
    requirements.push({
      itemId: item.id,
      rawText: item.rawText,
      // Weighted produce is priced per kg; a list quantity ("3 עגבניות") isn't kilos.
      quantity: weighted ? 1 : quantity,
      estimated: weighted,
      itemKeys: typical.map((o) => o.itemKey),
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
    requirements.map((r) => ({ id: r.itemId, itemKeys: r.itemKeys })),
  );
  const prices = new Map<number, Map<string, PricedLine>>();
  for (const row of rows) {
    const byItem = prices.get(row.branchId) ?? new Map<string, PricedLine>();
    byItem.set(row.requirementId, { itemKey: row.itemKey, name: row.name, priceAgorot: row.priceAgorot });
    prices.set(row.branchId, byItem);
  }

  const { quotes, unavailableEverywhere } = computeBasketQuotes({ requirements, branches, prices, limit: input.limit });
  const chosenKeyByItem = new Map(requirements.map((r) => [r.itemId, r.chosenKey]));
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
      estimated: q.estimated,
      missingItems: q.missingItems,
      lines: q.lines.map((line) => {
        const chosenKey = chosenKeyByItem.get(line.itemId);
        // Priced with an equivalent of the shopper's pick (another chain's barcode).
        return { ...line, substitute: chosenKey !== undefined && line.itemKey !== chosenKey };
      }),
    })),
    // Not counted against any branch: no linked products, or no branch in the city sells them.
    unpricedItems: [...unpriceable, ...unavailableEverywhere],
  };
}
