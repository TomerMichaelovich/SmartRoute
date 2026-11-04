/**
 * Coordinates for retail branches, so the cheapest-basket results can show how
 * far each one is. OpenStreetMap's Nominatim: free and keyless, at most one
 * request a second (its usage policy), and every result is stored, so a branch
 * is looked up again only when its address changes. Branches it can't place
 * get coordinates pasted in the admin ("manual"), which this never overwrites.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** What a branch was last geocoded from: re-geocode when this changes. */
export function geocodeKey(address: string | null, city: string | null): string {
  return `${address ?? ""}|${city ?? ""}`;
}

/**
 * The chains' address field, as a geocoder reads it: "64 יוהנה זבוטינסקי" ->
 * "יוהנה זבוטינסקי 64", "קנ.אביה שד.שאול המלך" -> "קניון אביה שדרות שאול המלך".
 * Null when there's nothing to look up.
 */
export function cleanBranchAddress(address: string | null): string | null {
  const cleaned = (address ?? "")
    .replace(/רח['׳]\s*/g, "")
    .replace(/קנ\.\s*/g, "קניון ")
    .replace(/שד\.\s*/g, "שדרות ")
    .replace(/(^|\s)י-ם(?=\s|$)/g, "$1ירושלים")
    .replace(/(^|\s)ב\.ג(?=\s|$)/g, "$1בן גוריון")
    .replace(/([א-ת])(\d)/g, "$1 $2")
    .replace(/^(\d+)\s+(.+)$/, "$2 $1")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 3 && /[א-תa-z]/i.test(cleaned) ? cleaned : null;
}

const compact = (text: string) => text.replace(/[\s\-'"׳״]/g, "");

/**
 * Whether a geocoder's place description ("דרך חברון, העיר העתיקה, באר-שבע, נפת
 * באר שבע, ...") is in the given city: one of its parts must be the city itself -
 * "נפת באר שבע" is the whole sub-district, towns 30 km away included.
 */
export function inCity(displayName: string, city: string): boolean {
  return displayName.split(",").some((part) => compact(part) === compact(city));
}

const USER_AGENT = "NAVIO price pilot (navio.co.il)";

/**
 * One lookup: "<address>, <city>", accepted only inside that city - a street
 * name repeats across cities, and a near miss elsewhere is worse than none.
 */
export async function geocodeAddress(address: string, city: string): Promise<GeoPoint | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=json&limit=3&countrycodes=il&accept-language=he&q=" +
    encodeURIComponent(`${address}, ${city}`);
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const hit = results.find((r) => inCity(r.display_name, city));
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

/**
 * "31.2341, 34.7996" as copied from Google Maps (also with spaces or a
 * semicolon), within Israel's rough bounds; null otherwise.
 */
export function parseCoordinates(text: string): GeoPoint | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return lat >= 29 && lat <= 34 && lng >= 34 && lng <= 36 ? { lat, lng } : null;
}
