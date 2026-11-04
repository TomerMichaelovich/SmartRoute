import type { ShoppingList, ShoppingListItemPlaceChoice } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";

/**
 * Plans the list's route at a NAVIO-mapped store. Returns the new route id, or
 * the message to show when the store's map can't produce a route.
 */
export async function startRouteAtStore(
  listCode: string,
  storeId: string,
  /** Answers given just now, in case saving one on the list hasn't landed (or failed). */
  placeChoices?: Map<string, ShoppingListItemPlaceChoice>,
): Promise<{ routeId: string } | { error: string }> {
  try {
    const listRes = await apiFetch(`/api/lists/${listCode}`);
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
    const { list }: { list: ShoppingList } = await listRes.json();
    const items = list.items.map((item) => {
      const placeChoice = placeChoices?.get(item.id);
      return placeChoice ? { ...item, placeChoice } : item;
    });
    const res = await apiFetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, shoppingListId: list.id, items }),
    });
    if (!res.ok) {
      const body: { code?: string } | null = await res.json().catch(() => null);
      return {
        error:
          body?.code === "missing_entrance_or_checkout"
            ? he.review.missingEntranceOrCheckout
            : body?.code === "disconnected_graph"
              ? he.review.disconnectedGraph
              : he.common.error,
      };
    }
    const route: { id: string } = await res.json();
    return { routeId: route.id };
  } catch {
    return { error: he.common.error };
  }
}
