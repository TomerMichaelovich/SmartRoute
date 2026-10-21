import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

/**
 * The shopper's city for price comparison (prices are only ever compared
 * within one city). Approximate location is enough — the app only asks for
 * coarse location — and coordinates never leave the device except to show
 * distances; the city name is what the server matches on.
 */

export type DetectedCity =
  | { status: "ok"; cityName: string; lat: number; lng: number }
  | { status: "denied" }
  | { status: "unavailable" };

const POSITION_TIMEOUT_MS = 10_000;
const MAX_LAST_KNOWN_AGE_MS = 10 * 60_000;

let cached: { at: number; result: DetectedCity & { status: "ok" } } | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

export async function detectCity(): Promise<DetectedCity> {
  if (cached && Date.now() - cached.at < MAX_LAST_KNOWN_AGE_MS) return cached.result;
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return { status: "denied" };

    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: MAX_LAST_KNOWN_AGE_MS })) ??
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), POSITION_TIMEOUT_MS));
    if (!position) return { status: "unavailable" };

    const { latitude: lat, longitude: lng } = position.coords;
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const cityName = place?.city ?? place?.subregion ?? place?.district ?? null;
    if (!cityName) return { status: "unavailable" };

    const result = { status: "ok" as const, cityName, lat, lng };
    cached = { at: Date.now(), result };
    return result;
  } catch {
    // No location services, geocoder unavailable, etc. — the city picker takes over.
    return { status: "unavailable" };
  }
}

// The city the shopper picked by hand, offered first the next time location isn't available.
const SAVED_CITY_KEY = "price-city";

export async function getSavedCity(): Promise<{ code: number; name: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_CITY_KEY);
    return raw ? (JSON.parse(raw) as { code: number; name: string }) : null;
  } catch {
    return null;
  }
}

export async function saveCity(city: { code: number; name: string }): Promise<void> {
  try {
    await AsyncStorage.setItem(SAVED_CITY_KEY, JSON.stringify(city));
  } catch {
    // Best effort: the picker just shows again next time.
  }
}
