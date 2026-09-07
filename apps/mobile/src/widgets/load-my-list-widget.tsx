import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { apiFetch } from "@/lib/api";
import { clearMyListCode, getMyListCode } from "@/lib/my-list-storage";
import { MyListWidget } from "./MyListWidget";

// Matches the native widget "name" in apps/mobile/app.json's react-native-android-widget
// plugin config - kept as "HelloWidget" (the Phase A validation name) rather than renamed,
// since renaming it is a native-level change requiring a fresh EAS build, and it's an
// internal identifier only (the user-facing "label" there already says "SmartRoute").
export const MY_LIST_WIDGET_NAME = "HelloWidget";

/**
 * Shared between the headless widget task handler (index.tsx, runs on Android's own
 * update schedule) and the in-app trigger (HomeListWidget-adjacent screens, via
 * requestWidgetUpdate) that refreshes the widget the moment the list actually changes,
 * instead of waiting for Android's periodic tick.
 */
export async function loadMyListWidget() {
  const code = await getMyListCode();
  if (!code) return <MyListWidget />;

  try {
    const res = await apiFetch(`/api/lists/${code}`);
    if (!res.ok) {
      await clearMyListCode();
      return <MyListWidget />;
    }
    const data: { list: ShoppingList; store: Store | null } = await res.json();
    return <MyListWidget storeName={data.store?.name} itemCount={data.list.items.length} />;
  } catch {
    return <MyListWidget />;
  }
}
