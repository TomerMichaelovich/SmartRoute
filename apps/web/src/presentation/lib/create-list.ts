import "server-only";
import { resolveAvailability } from "@smartroute/core/application/classification/resolve-availability";
import { generateShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import {
  classificationService,
  productListingRepository,
  shoppingListRepository,
} from "@/src/infrastructure/container";

interface CreateListInput {
  storeId: string;
  rawItems: string[];
  /** When set, the list is owned by this user and becomes their active list. */
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
  const [rawClassifications, listings] = await Promise.all([
    classificationService.classifyBatch(rawTexts),
    productListingRepository.findByStore(storeId),
  ]);
  return rawTexts.map((rawText, i) => ({
    id: crypto.randomUUID(),
    rawText,
    classification: resolveAvailability(rawClassifications[i], storeId, listings),
    ...(addedByUserId ? { addedByUserId } : {}),
  }));
}

/**
 * Shared list-creation path: classify the raw lines, resolve per-store
 * availability, mint a unique shareCode, persist, and (for a logged-in owner)
 * make it the active list. Used by POST /api/classify and "repeat a past trip".
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
  if (ownerUserId) {
    await shoppingListRepository.setActive(list.id, ownerUserId);
  }
  return list;
}
