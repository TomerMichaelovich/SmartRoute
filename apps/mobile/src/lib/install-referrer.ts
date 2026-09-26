import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { Platform } from "react-native";
import { isSharedLinkPath } from "@/lib/app-links";

const REFERRER_CHECKED_STORAGE_KEY = "smartroute:installReferrerChecked";

/**
 * Deferred deep link: the site's Play Store button for a shared link carries
 * its path as the install referrer (`navio_path=<path>`, see the web's
 * app-links.ts), so a user who installed the app from an invite link lands
 * back on that invite on first launch. Android only, checked once per install.
 */
export async function consumeInstallReferrerPath(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    if (await AsyncStorage.getItem(REFERRER_CHECKED_STORAGE_KEY)) return null;
    await AsyncStorage.setItem(REFERRER_CHECKED_STORAGE_KEY, "1");
    const referrer = await Application.getInstallReferrerAsync();
    return parseReferrerPath(referrer);
  } catch {
    // No Play Store (sideloaded/dev build) or the referrer service is unavailable.
    return null;
  }
}

function parseReferrerPath(referrer: string): string | null {
  for (const pair of referrer.split("&")) {
    const [key, value] = pair.split("=");
    if (key !== "navio_path" || !value) continue;
    const path = decodeURIComponent(value);
    return isSharedLinkPath(path) ? path : null;
  }
  return null;
}
