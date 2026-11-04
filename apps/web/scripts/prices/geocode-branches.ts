import { cleanBranchAddress, geocodeAddress, geocodeKey } from "@/src/infrastructure/prices/geocode";
import { cityName } from "@/src/infrastructure/prices/settlements";
import { connect } from "./db";

/**
 * Coordinates for the branches that take part in quotes, so the cheapest-basket
 * results can show each one's distance. Looks up only branches never geocoded
 * or whose address changed since (geocoded_address), one request a second
 * (Nominatim's policy). Coordinates set by hand in the admin (status "manual")
 * are never touched.
 *
 * Usage: tsx scripts/prices/geocode-branches.ts [--dry-run] [--force] [--prod]
 *   --force  re-geocode every non-manual branch, not only new/changed ones
 */

type BranchRow = { id: number; name: string; address: string | null; city_code: number | null; geocode_status: string; geocoded_address: string | null };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const { sql, target } = connect();
  console.log(`[${target}] geocode-branches${dryRun ? " (dry run)" : ""}${force ? " (force)" : ""}`);

  const rows = (await sql`SELECT id, name, address, city_code, geocode_status, geocoded_address FROM retail_branches
                          WHERE prices_enabled AND is_active AND is_retail AND geocode_status <> 'manual'
                          ORDER BY id`) as BranchRow[];
  const todo = rows
    .map((row) => {
      const city = row.city_code === null ? null : cityName(row.city_code);
      return { row, city, key: geocodeKey(row.address, city) };
    })
    .filter(({ row, key }) => force || row.geocode_status === "pending" || row.geocoded_address !== key);
  console.log(`${todo.length} of ${rows.length} branches to geocode`);

  let found = 0;
  for (const [index, { row, city, key }] of todo.entries()) {
    const address = cleanBranchAddress(row.address);
    let point = null;
    if (address && city) {
      if (index > 0) await sleep(1100);
      point = await geocodeAddress(address, city);
    }
    if (point) found++;
    console.log(`${point ? "✓" : "✗"} ${row.id} ${row.name} | ${row.address ?? "(no address)"}${point ? ` -> ${point.lat.toFixed(5)},${point.lng.toFixed(5)}` : ""}`);
    if (dryRun) continue;
    // Not found is remembered too (until the address changes): no daily retries against the same answer.
    await sql`UPDATE retail_branches SET lat = ${point?.lat ?? null}, lng = ${point?.lng ?? null},
                geocode_status = ${point ? "ok" : "not_found"}, geocoded_address = ${key}
              WHERE id = ${row.id} AND geocode_status <> 'manual'`;
  }
  console.log(`found ${found}/${todo.length}${todo.length - found ? " - set the rest by hand in the admin (סניפים -> מיקום סניפי מחירים)" : ""}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
