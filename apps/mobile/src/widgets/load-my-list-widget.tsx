import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { apiFetch } from "@/lib/api";
import { loadStoredToken } from "@/lib/auth-token";
import { clearMyListCode, getMyListCode } from "@/lib/my-list-storage";
import { MyListWidget, type MyListWidgetItem } from "./MyListWidget";
import { getWidgetListExpanded } from "./widget-list-state";

// Matches the native widget "name" in apps/mobile/app.json's react-native-android-widget
// plugin config - kept as "HelloWidget" (the Phase A validation name) rather than renamed,
// since renaming it is a native-level change requiring a fresh EAS build, and it's an
// internal identifier only (the user-facing "label" there already says "SmartRoute").
export const MY_LIST_WIDGET_NAME = "HelloWidget";

/**
 * Shared between the headless widget task handler (index.tsx, runs on Android's own
 * update schedule or in response to a WIDGET_CLICK) and the in-app trigger
 * (refresh-my-list-widget.ts) that refreshes the widget the moment the list actually
 * changes, instead of waiting for Android's periodic tick.
 */
export async function loadMyListWidget() {
  // The headless task can run without the main app's AuthProvider ever mounting, so
  // apiFetch's in-memory bearer token (auth-token.ts) may still be unset - load it from
  // SecureStore here too, or a logged-in user's own (non-guest) list would 403.
  await loadStoredToken();

  const code = await getMyListCode();
  if (!code) return <MyListWidget />;

  try {
    const res = await apiFetch(`/api/lists/${code}`);
    if (!res.ok) {
      await clearMyListCode();
      return <MyListWidget />;
    }
    const data: { list: ShoppingList } = await res.json();

    let products: Product[] = [];
    const productsRes = await apiFetch(`/api/shopping-lists/${data.list.id}`).catch(() => null);
    if (productsRes?.ok) {
      const productsData: { products: Product[] } = await productsRes.json();
      products = productsData.products;
    }
    const productById = new Map(products.map((p) => [p.id, p]));

    const items: MyListWidgetItem[] = data.list.items.map((item) => {
      const product = item.classification?.matchedProductId ? productById.get(item.classification.matchedProductId) : undefined;
      return {
        id: item.id,
        name: product?.canonicalName ?? item.rawText,
        checked: Boolean(item.checked),
        category: product?.category ?? "other",
      };
    });

    const expanded = await getWidgetListExpanded();
    return <MyListWidget shareCode={code} items={items} expanded={expanded} />;
  } catch {
    return <MyListWidget />;
  }
}
