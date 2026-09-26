import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * RN port of the web's local-cleanup.ts: wipes device-local, list-related
 * state on logout so the next person on this device doesn't see the
 * previous user's guest list or saved route progress. The session token
 * itself is cleared separately (see auth-token.ts's clearToken).
 */
export async function clearLocalUserData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      (key) => key === "smartroute:myListCode" || key.startsWith("smartroute:route:"),
    );
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  } catch {
    // Best-effort - a blocked AsyncStorage means there was nothing to leak anyway.
  }
}
