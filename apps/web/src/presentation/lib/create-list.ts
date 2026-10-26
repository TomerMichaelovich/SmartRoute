import "server-only";
import { parseLineQuantity } from "@smartroute/core/application/classification/list-line";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import {
  classificationService,
  productListingRepository,
  productRepository,
  shoppingListRepository,
} from "@/src/infrastructure/container";

interface CreateListInput {
  storeId: string;
  rawItems: string[];
  /** When set, the list is owned by this user and joins their active (home-screen) lists. */
  ownerUserId: string | null;
  /** When set, the list is a household's shared list (no personal owner). */
  householdId?: string | null;
  name?: string | null;
}

/**
 * Classifies raw lines into ShoppingListItems for a given store (shared by
 * list creation and adding items to an existing list).
 */
export async function classifyLines(
  storeId: string,
  rawTexts: string[],
  addedByUserId?: string,
): Promise<ShoppingListItem[]> {
  const [rawClassifications, listings, products] = await Promise.all([
    classificationService.classifyBatch(rawTexts),
    productListingRepository.findByStore(storeId),
    productRepository.findAllActive(),
  ]);
  return rawTexts.map((rawText, i) => {
    // "3 חלב" / "חלב x2": the count the shopper typed into the line.
    const quantity = parseLineQuantity(rawText);
    return {
      id: crypto.randomUUID(),
      rawText,
      // No same-name swap here: the store is often a placeholder; the route picks the shelf.
      classification: resolveAvailability(rawClassifications[i], storeId, listings, products, { switchToCarried: false }),
      ...(quantity ? { quantity } : {}),
      ...(addedByUserId ? { addedByUserId } : {}),
    };
  });
}

/**
 * Shared list-creation path: classify the raw lines, resolve per-store
 * availability, mint a unique shareCode, persist, and (for a logged-in owner)
 * add it to their active lists. Used by POST /api/classify and "repeat a past trip".
 */
export async function createShoppingList({
  storeId,
  rawItems,
  ownerUserId,
  householdId = null,
  name = null,
}: CreateListInput): Promise<ShoppingList> {
  const items = await classifyLines(storeId, rawItems);

  let shareCode = generateShareCode();
  while (await shoppingListRepository.findByShareCode(shareCode)) {
    shareCode = generateShareCode();
  }

  const now = new Date().toISOString();
  const list: ShoppingList = {
    id: crypto.randomUUID(),
    storeId,
    items,
    shareCode,
    ownerUserId,
    householdId,
    name,
    isActive: Boolean(ownerUserId),
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await shoppingListRepository.create(list);
  return list;
}
