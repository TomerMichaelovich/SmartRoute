import type { Product } from "@smartroute/core/domain/entities/product";
import type { ProductListing } from "@smartroute/core/domain/entities/product-listing";
import type { ShoppingListItem, ShoppingListItemPlaceChoice } from "@smartroute/core/domain/entities/shopping-list";
import { effectiveVariant } from "../basket/effective-variant";
import { listLineCores } from "../classification/list-line";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";

/**
 * A mapped store can carry several products that answer to one list item - the
 * generic "טחינה גולמית" and the chain's own "טחינה גולמית רמי לוי", or the dozens
 * of yellow cheeses imported from its price file. Classification picks one kind of
 * product for everyone ("גבינה צהובה"), which says nothing about which shelf the
 * shopper wants here. Products on the same shelf (map node) are one place: the
 * route only asks (see placeQuestions) when they stand in more than one, and for
 * "לא משנה לי" takes the place that keeps the walk shortest.
 */

/**
 * Generic products' linked barcodes (product_sku_links), so an item classified as
 * "גבינה צהובה" also finds the imported yellow cheeses whose own aliases don't say so.
 */
export type GenericSkuKeys = Map<string, Set<string>>;

/** What one store carries, indexed once per request (routing looks up every item). */
interface StorePlaces {
  carried: Set<string>;
  /** Normalized name/alias -> carried products answering to it, in catalog order. */
  byAlias: Map<string, string[]>;
  nodeOf: Map<string, string>;
  /** Barcode -> the carried product imported for it. */
  byItemKey: Map<string, string>;
  productById: Map<string, Product>;
}

const placesCache = new WeakMap<ProductListing[], WeakMap<Product[], Map<string, StorePlaces>>>();

function storePlaces(storeId: string, listings: ProductListing[], products: Product[]): StorePlaces {
  let byProducts = placesCache.get(listings);
  if (!byProducts) placesCache.set(listings, (byProducts = new WeakMap()));
  let byStore = byProducts.get(products);
  if (!byStore) byProducts.set(products, (byStore = new Map()));
  const cached = byStore.get(storeId);
  if (cached) return cached;

  const nodeOf = new Map<string, string>();
  for (const l of listings) if (l.storeId === storeId && !nodeOf.has(l.productId)) nodeOf.set(l.productId, l.nodeId);
  const places: StorePlaces = {
    carried: new Set(nodeOf.keys()),
    byAlias: new Map(),
    nodeOf,
    byItemKey: new Map(),
    productById: new Map(),
  };
  for (const product of products) {
    if (!places.carried.has(product.id)) continue;
    places.productById.set(product.id, product);
    if (product.sourceItemKey) places.byItemKey.set(product.sourceItemKey, product.id);
    for (const alias of new Set(product.normalizedAliases)) {
      const ids = places.byAlias.get(alias);
      if (ids) ids.push(product.id);
      else places.byAlias.set(alias, [product.id]);
    }
  }
  byStore.set(storeId, places);
  return places;
}

/**
 * Products carried at this store that the item's text names, the classified one
 * first. Fewer than two: nothing to choose. A product named by exactly what was
 * typed settles it: "שישיית קולה" is the six-pack, even though without its pack
 * word ("קולה") it would also name the single bottle. Only when nothing matches
 * the line as typed does its cleaner form count ("2 טחינה" -> "טחינה"), along with
 * the imported products linked to the classified generic product (`genericSkuKeys`).
 */
export function placeCandidates(
  item: ShoppingListItem,
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  genericSkuKeys?: GenericSkuKeys,
): string[] {
  const places = storePlaces(storeId, listings, products);
  const normalized = normalizeHebrewText(item.rawText);
  const matched = item.classification?.matchedProductId;
  const exact = places.byAlias.get(normalized) ?? [];
  if (exact.length > 0) return [...exact].sort((a, b) => Number(b === matched) - Number(a === matched));

  const candidates = new Set<string>();
  if (matched && places.carried.has(matched)) candidates.add(matched);
  for (const core of listLineCores(normalized)) {
    for (const id of places.byAlias.get(core) ?? []) candidates.add(id);
  }
  for (const itemKey of (matched && genericSkuKeys?.get(matched)) || []) {
    const id = places.byItemKey.get(itemKey);
    if (id) candidates.add(id);
  }
  return [...candidates];
}

/** One place an item could be taken from: a node, and the candidates standing there. */
export interface PlaceOption {
  nodeId: string;
  /** Stands for the place: the classified product if it's here, else a hand-made one, else the shortest name. */
  productId: string;
  productIds: string[];
}

/** The candidates by the node they stand at, in candidate order. */
export function placeOptions(
  item: ShoppingListItem,
  productIds: string[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
): PlaceOption[] {
  const places = storePlaces(storeId, listings, products);
  const byNode = new Map<string, string[]>();
  for (const id of productIds) {
    const nodeId = places.nodeOf.get(id);
    if (!nodeId) continue;
    const ids = byNode.get(nodeId);
    if (ids) ids.push(id);
    else byNode.set(nodeId, [id]);
  }
  const matched = item.classification?.matchedProductId;
  const rank = (id: string) => {
    const product = places.productById.get(id);
    return [id === matched ? 0 : 1, product?.sourceItemKey ? 1 : 0, product?.canonicalName.length ?? Infinity];
  };
  const byRank = (a: string, b: string) => {
    const [ra, rb] = [rank(a), rank(b)];
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  };
  return [...byNode].map(([nodeId, ids]) => ({ nodeId, productIds: ids, productId: [...ids].sort(byRank)[0] }));
}

/** The item's saved choice, unless the item was edited since. */
export function effectivePlaceChoice(item: ShoppingListItem): ShoppingListItemPlaceChoice | null {
  const choice = item.placeChoice;
  if (!choice || choice.text !== normalizeHebrewText(item.rawText)) return null;
  return choice;
}

/**
 * The candidate the item's cheapest-basket pick points to: a barcode chosen in
 * that popup ("טחינה גולמית רמי לוי 500 ג") linked to one of the candidates.
 * The generic product is usually linked to it too, so the most specific one
 * (fewest linked barcodes) wins.
 */
function pickedInBasket(item: ShoppingListItem, productIds: string[], skuKeys: Map<string, Set<string>> | undefined): string | null {
  const variant = item.variant;
  if (!skuKeys || variant?.kind !== "sku" || !variant.itemKey) return null;
  if (variant.productId && !productIds.includes(variant.productId)) return null;
  const linked = productIds.filter((id) => skuKeys.get(id)?.has(variant.itemKey!));
  if (linked.length === 0) return null;
  return linked.reduce((best, id) => (skuKeys.get(id)!.size < skuKeys.get(best)!.size ? id : best));
}

/** The product imported for the barcode picked in the cheapest-basket popup, when the store has it placed. */
function pickedBarcode(item: ShoppingListItem, storeId: string, listings: ProductListing[], products: Product[]): string | null {
  const variant = effectiveVariant(item);
  if (variant?.kind !== "sku" || !variant.itemKey) return null;
  return storePlaces(storeId, listings, products).byItemKey.get(variant.itemKey) ?? null;
}

export interface PlaceQuestion {
  itemId: string;
  rawText: string;
  /** One per place: the product standing for it. */
  productIds: string[];
  options: PlaceOption[];
}

/**
 * Items to ask about before routing at this store: candidates standing in more than
 * one place, and no saved choice that applies here ("לא משנה לי" applies everywhere;
 * a product applies where it's one of the candidates) nor a cheapest-basket pick
 * that settles it. `skuKeys`: each candidate product's linked barcodes.
 */
export function placeQuestions(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  skuKeys?: Map<string, Set<string>>,
  genericSkuKeys?: GenericSkuKeys,
): PlaceQuestion[] {
  const questions: PlaceQuestion[] = [];
  for (const item of items) {
    if (item.checked) continue;
    if (pickedBarcode(item, storeId, listings, products)) continue;
    const productIds = placeCandidates(item, storeId, listings, products, genericSkuKeys);
    if (productIds.length < 2) continue;
    const choice = effectivePlaceChoice(item);
    if (choice && (choice.productId === null || productIds.includes(choice.productId))) continue;
    if (pickedInBasket(item, productIds, skuKeys)) continue;
    const options = placeOptions(item, productIds, storeId, listings, products);
    if (options.length < 2) continue;
    questions.push({ itemId: item.id, rawText: item.rawText, productIds: options.map((o) => o.productId), options });
  }
  return questions;
}

/**
 * What the route takes for each item that has a say here. `chosen`: settled - the
 * product imported for a barcode picked in the cheapest basket, the only candidate,
 * a saved pick, a basket pick linked to a candidate, or the one place all candidates
 * stand at. `flexible`: one product per place, left to the route (routing never
 * blocks on a question: mid-shop re-plans and the review screen don't ask).
 */
export function placeDecisions(
  items: ShoppingListItem[],
  storeId: string,
  listings: ProductListing[],
  products: Product[],
  skuKeys?: Map<string, Set<string>>,
  genericSkuKeys?: GenericSkuKeys,
): { chosen: Map<string, string>; flexible: Map<string, string[]> } {
  const chosen = new Map<string, string>();
  const flexible = new Map<string, string[]>();
  for (const item of items) {
    const barcode = pickedBarcode(item, storeId, listings, products);
    if (barcode) {
      chosen.set(item.id, barcode);
      continue;
    }
    const productIds = placeCandidates(item, storeId, listings, products, genericSkuKeys);
    if (productIds.length === 0) continue;
    if (productIds.length === 1) {
      if (productIds[0] !== item.classification?.matchedProductId) chosen.set(item.id, productIds[0]);
      continue;
    }
    const choice = effectivePlaceChoice(item);
    const picked =
      choice?.productId && productIds.includes(choice.productId)
        ? choice.productId
        : choice?.productId === null
          ? null
          : pickedInBasket(item, productIds, skuKeys);
    if (picked) {
      chosen.set(item.id, picked);
      continue;
    }
    const options = placeOptions(item, productIds, storeId, listings, products);
    if (options.length === 1) chosen.set(item.id, options[0].productId);
    else if (options.length > 1) flexible.set(item.id, options.map((o) => o.productId));
  }
  return { chosen, flexible };
}
