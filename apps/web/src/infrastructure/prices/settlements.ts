import { SETTLEMENTS } from "./settlements-data";

/**
 * CBS settlement codes <-> names. Price comparison only ever happens within one
 * city, identified by its CBS code: branches get it from the chains' Stores files,
 * the shopper from their reverse-geocoded city name.
 */

// Strip everything that varies between spellings of the same name:
// "באר-שבע", "באר שבע", "BE'ER SHEVA", "Be'er-Sheva" all collapse together.
export function normalizeCityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // niqqud / cantillation
    .replace(/[̀-ͯ]/g, "") // latin diacritics
    .toLowerCase()
    .replace(/['"`׳״’]/g, "")
    .replace(/[-–—_.,()/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Common spellings and abbreviations that the CBS list doesn't carry, including
// what Android's geocoder returns for the bigger cities.
const ALIASES: Record<string, number> = {
  "בש": 9000,
  beersheba: 9000,
  "beer sheba": 9000,
  "beer sheva": 9000,
  "תא": 5000,
  "תל אביב": 5000,
  "תל אביב יפו": 5000,
  "tel aviv": 5000,
  "tel aviv yafo": 5000,
  "tel aviv jaffa": 5000,
  "ים": 3000,
  jerusalem: 3000,
  haifa: 4000,
  "פתח תקוה": 7900,
  "פתח תקווה": 7900,
  "petah tikva": 7900,
  "ראשלצ": 8300,
  "rishon lezion": 8300,
  "rishon letsiyon": 8300,
  "קרית גת": 2630,
  "קריית גת": 2630,
};

const byCode = new Map<number, { he: string; en: string }>();
const byName = new Map<string, number>();
for (const [code, he, en] of SETTLEMENTS) {
  byCode.set(code, { he, en });
  for (const name of [he, en]) {
    const key = normalizeCityName(name);
    if (key && !byName.has(key)) byName.set(key, code);
  }
}
for (const [name, code] of Object.entries(ALIASES)) byName.set(normalizeCityName(name), code);

export function cityName(code: number): string | null {
  return byCode.get(code)?.he ?? null;
}

/** A city name (Hebrew or English, any common spelling) -> CBS code. */
export function cityCodeFromName(name: string | null | undefined): number | null {
  if (!name) return null;
  const key = normalizeCityName(name);
  return byName.get(key) ?? byName.get(key.replace(/^(קרית|קריית) /, "קרית ")) ?? null;
}

/**
 * The <City> value of a Stores file -> CBS code. Usually it already is a code;
 * some chains publish a name; "0"/empty means unknown (null).
 */
export function cityCodeFromStoresValue(raw: string | null | undefined): number | null {
  const value = raw?.trim();
  if (!value || value === "0" || value.toLowerCase() === "unknown") return null;
  if (/^\d+$/.test(value)) {
    const code = Number(value);
    return byCode.has(code) ? code : null;
  }
  return cityCodeFromName(value);
}

/**
 * Last resort for chains that publish no city at all (Yohananof: City=0,
 * Address=unknown): the longest settlement name that appears as whole words in
 * the branch name. Never use this when <City> is present — "אקספרס להבים באר
 * שבע" is in Lehavim, not Be'er Sheva.
 */
export function cityCodeFromBranchName(branchName: string): number | null {
  const words = ` ${normalizeCityName(branchName)} `;
  let best: { code: number; length: number } | null = null;
  for (const [key, code] of byName) {
    if (key.length < 3) continue;
    if (words.includes(` ${key} `) && (!best || key.length > best.length)) best = { code, length: key.length };
  }
  return best?.code ?? null;
}
