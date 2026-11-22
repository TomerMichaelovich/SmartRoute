import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import type { Route } from "@smartroute/core/domain/entities/route";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { apiFetch } from "@/lib/api";
import { saveCheckedItemIds } from "@/lib/route-storage";

/**
 * "Take me there": re-plans the route mid-shop so this item is taken from another place, which
 * becomes the next stop. Ticks carry over, and the pick is saved on the item like any other.
 * Returns the new route's id.
 */
export async function routeToOtherPlace({
  route,
  storeId,
  checkedItemIds,
  itemId,
  productId,
  nodeId,
}: {
  route: Route;
  storeId: string;
  checkedItemIds: Set<string>;
  itemId: string;
  productId: string;
  nodeId: string;
}): Promise<string> {
  // Fresh from the server: saving the route writes these items back over the list.
  const listRes = await apiFetch(`/api/shopping-lists/${route.shoppingListId}?scope=catalog`);
  if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
  const { shoppingList }: { shoppingList: ShoppingList } = await listRes.json();
  if (!shoppingList.items.some((item) => item.id === itemId)) throw new Error("Item no longer on the list");

  const chosenAt = new Date().toISOString();
  const items = shoppingList.items.map((item) =>
    item.id === itemId ? { ...item, placeChoice: { productId, text: normalizeHebrewText(item.rawText), chosenAt } } : item,
  );
  const listIds = new Set(items.map((item) => item.id));
  const completedItemIds = [...checkedItemIds].filter((id) => listIds.has(id) && id !== itemId);
  // What this route left out stays out.
  const skippedItemIds = route.unresolvedItemIds.filter((id) => listIds.has(id) && id !== itemId);

  const res = await apiFetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      storeId,
      shoppingListId: route.shoppingListId,
      items,
      completedItemIds,
      skippedItemIds,
      nextStopNodeId: nodeId,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const newRoute: { id: string } = await res.json();
  await saveCheckedItemIds(newRoute.id, new Set(completedItemIds));
  return newRoute.id;
}
