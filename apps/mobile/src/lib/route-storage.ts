import AsyncStorage from "@react-native-async-storage/async-storage";

// Matches the web app's storageKey() in RouteView.tsx, so the checked-item persistence
// behaves the same way (each route gets its own key, survives a reload/app-switch).
function storageKey(routeId: string): string {
  return `smartroute:route:${routeId}:checked`;
}

export async function loadCheckedItemIds(routeId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(routeId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export async function saveCheckedItemIds(routeId: string, ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(routeId), JSON.stringify(Array.from(ids)));
  } catch {
    // Best-effort - progress just won't survive a reload if this fails.
  }
}
