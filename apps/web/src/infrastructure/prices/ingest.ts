import { randomUUID } from "crypto";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { normalizeHebrewText } from "@smartroute/core/application/classification/normalize-hebrew-text";
import { decodePriceFile, itemKeyFor, parsePriceFullXml, parseStoresXml, type ParsedPriceItem } from "./parse";
import { type ChainConfig, isRetailBranch, MAX_PRICE_FILE_AGE_HOURS, PRICE_CITY_CODES } from "./pilot-config";
import { portalAdapter } from "./portals";
import { cityCodeFromBranchName, cityCodeFromStoresValue } from "./settlements";

type Sql = NeonQueryFunction<false, false>;

export interface IngestOptions {
  dryRun?: boolean;
  /** Re-ingest even when the newest file is the one already loaded. */
  force?: boolean;
  /** Limit to these store codes (dev runs). */
  storeCodes?: string[];
  log?: (line: string) => void;
}

/**
 * Retail item names glue numbers to words ("מועשר3%כד 2ל"); split them so the
 * trigram / whole-word matching used by the SKU linker sees separate tokens.
 */
export function normalizeRetailName(name: string): string {
  // Keep decimal points: "1.5 ליטר" must not become "1 5 ליטר" (= 5 liters).
  const DECIMAL = "․";
  return normalizeHebrewText(name.replace(/(\d)[.,](\d)/g, `$1${DECIMAL}$2`))
    .replaceAll(DECIMAL, ".")
    .replace(/([א-ת])(\d)/g, "$1 $2")
    .replace(/([\d%])([א-ת])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Israel-local "YYYY-MM-DD HH:mm:ss" — the clock the file names use. */
function israelNow(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
}

function hoursBetween(a: string, b: string): number {
  return (Date.parse(b.replace(" ", "T")) - Date.parse(a.replace(" ", "T"))) / 3_600_000;
}

const nowIso = () => new Date().toISOString();

async function startRun(sql: Sql, mode: string, chainId: string, dryRun: boolean): Promise<string | null> {
  if (dryRun) return null;
  const id = randomUUID();
  await sql`INSERT INTO price_ingest_runs (id, mode, chain_id, status, started_at)
            VALUES (${id}, ${mode}, ${chainId}, 'running', ${nowIso()})`;
  return id;
}

async function finishRun(
  sql: Sql,
  id: string | null,
  result: { status: "ok" | "failed"; files: number; rowsUpserted: number; rowsDeleted: number; error?: string },
) {
  if (!id) return;
  await sql`UPDATE price_ingest_runs
            SET status = ${result.status}, files = ${result.files}, rows_upserted = ${result.rowsUpserted},
                rows_deleted = ${result.rowsDeleted}, error = ${result.error ?? null}, finished_at = ${nowIso()}
            WHERE id = ${id}`;
}

export async function upsertChains(sql: Sql, chains: readonly ChainConfig[], dryRun = false) {
  if (dryRun) return;
  for (const c of chains) {
    await sql`INSERT INTO retail_chains (id, gov_chain_id, name, portal, portal_config, is_enabled, updated_at)
              VALUES (${c.id}, ${c.govChainId}, ${c.name}, ${c.portal}, ${JSON.stringify(c.portalConfig)}::jsonb, true, ${nowIso()})
              ON CONFLICT (id) DO UPDATE SET gov_chain_id = excluded.gov_chain_id, name = excluded.name,
                portal = excluded.portal, portal_config = excluded.portal_config, updated_at = excluded.updated_at`;
  }
}

/**
 * Stores file -> retail_branches. Resolves each branch's CBS city, flags
 * wholesale branches, and enables prices for retail branches in pilot cities.
 * Branches that vanished from the file are deactivated, and branches no longer
 * price-enabled lose their price rows (keeps the database small).
 */
export async function ingestStores(sql: Sql, chain: ChainConfig, options: IngestOptions = {}) {
  const log = options.log ?? console.log;
  const runId = await startRun(sql, "stores", chain.id, !!options.dryRun);
  try {
    const xml = decodePriceFile(await portalAdapter(chain.portal, chain.portalConfig).fetchStoresFile());
    const { govChainId, branches } = parseStoresXml(xml);
    if (govChainId !== chain.govChainId) {
      throw new Error(`Stores file is for chain ${govChainId}, expected ${chain.govChainId}`);
    }

    const rows = branches.map((b) => {
      const hasCity = b.cityRaw !== null && b.cityRaw !== "0";
      // Fall back to the branch name only when the chain published no city at all.
      const cityCode = hasCity ? cityCodeFromStoresValue(b.cityRaw) : cityCodeFromBranchName(b.name);
      const isRetail = isRetailBranch(b);
      return { ...b, cityCode, isRetail, pricesEnabled: isRetail && cityCode !== null && PRICE_CITY_CODES.includes(cityCode) };
    });
    const enabled = rows.filter((r) => r.pricesEnabled);
    log(`  ${chain.id}: ${rows.length} branches, ${enabled.length} price-enabled`);
    for (const r of enabled) log(`    + ${r.storeCode} ${r.name} | ${r.address ?? "-"} | city ${r.cityCode}`);
    const unresolved = rows.filter((r) => r.cityCode === null).length;
    if (unresolved) log(`    (${unresolved} branches with no resolvable city)`);

    if (options.dryRun) return;

    const now = nowIso();
    await sql.query(
      `INSERT INTO retail_branches
         (chain_id, store_code, sub_chain_id, sub_chain_name, name, address, city_raw, city_code, is_retail, prices_enabled, is_active, updated_at)
       SELECT $1, t.store_code, t.sub_chain_id, t.sub_chain_name, t.name, t.address, t.city_raw, t.city_code, t.is_retail, t.prices_enabled, true, $2
       FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::int[], $10::bool[], $11::bool[])
         AS t(store_code, sub_chain_id, sub_chain_name, name, address, city_raw, city_code, is_retail, prices_enabled)
       ON CONFLICT (chain_id, store_code) DO UPDATE SET
         sub_chain_id = excluded.sub_chain_id, sub_chain_name = excluded.sub_chain_name, name = excluded.name,
         address = excluded.address, city_raw = excluded.city_raw, city_code = excluded.city_code,
         is_retail = excluded.is_retail, prices_enabled = excluded.prices_enabled, is_active = true,
         updated_at = excluded.updated_at`,
      [
        chain.id,
        now,
        rows.map((r) => r.storeCode),
        rows.map((r) => r.subChainId),
        rows.map((r) => r.subChainName),
        rows.map((r) => r.name),
        rows.map((r) => r.address),
        rows.map((r) => r.cityRaw),
        rows.map((r) => r.cityCode),
        rows.map((r) => r.isRetail),
        rows.map((r) => r.pricesEnabled),
      ],
    );
    await sql`UPDATE retail_branches SET is_active = false, prices_enabled = false, updated_at = ${now}
              WHERE chain_id = ${chain.id} AND is_active AND NOT (store_code = ANY(${rows.map((r) => r.storeCode)}))`;
    const removed = await sql`DELETE FROM branch_prices WHERE branch_id IN
                                (SELECT id FROM retail_branches WHERE chain_id = ${chain.id} AND NOT prices_enabled)
                              RETURNING branch_id`;
    await finishRun(sql, runId, { status: "ok", files: 1, rowsUpserted: rows.length, rowsDeleted: removed.length });
  } catch (e) {
    await finishRun(sql, runId, { status: "failed", files: 0, rowsUpserted: 0, rowsDeleted: 0, error: String(e) });
    throw e;
  }
}

const BATCH = 4000;

/** Upserts the file's items and returns item_key -> retail_items.id. */
async function upsertItems(sql: Sql, chainId: string, items: ParsedPriceItem[]): Promise<Map<string, number>> {
  const byKey = new Map<string, ParsedPriceItem & { itemKey: string; internal: boolean }>();
  for (const item of items) {
    const { itemKey, internal } = itemKeyFor(chainId, item);
    byKey.set(itemKey, { ...item, itemKey, internal });
  }
  const all = [...byKey.values()];
  const ids = new Map<string, number>();
  const now = nowIso();
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    // A barcode is shared across chains; keep the most informative name (Rami
    // Levy truncates names to ~20 chars) and fill missing details from any chain.
    const rows = (await sql.query(
      `INSERT INTO retail_items
         (item_key, item_code, chain_id, name, normalized_name, manufacturer, quantity, unit_qty, unit_of_measure, is_weighted, updated_at)
       SELECT t.item_key, t.item_code, t.chain_id, t.name, t.normalized_name, t.manufacturer, t.quantity, t.unit_qty, t.unit_of_measure, t.is_weighted, $1
       FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::float8[], $9::text[], $10::text[], $11::bool[])
         AS t(item_key, item_code, chain_id, name, normalized_name, manufacturer, quantity, unit_qty, unit_of_measure, is_weighted)
       ON CONFLICT (item_key) DO UPDATE SET
         name = CASE WHEN length(excluded.name) > length(retail_items.name) THEN excluded.name ELSE retail_items.name END,
         normalized_name = CASE WHEN length(excluded.name) > length(retail_items.name) THEN excluded.normalized_name ELSE retail_items.normalized_name END,
         manufacturer = COALESCE(retail_items.manufacturer, excluded.manufacturer),
         quantity = COALESCE(retail_items.quantity, excluded.quantity),
         unit_qty = COALESCE(retail_items.unit_qty, excluded.unit_qty),
         unit_of_measure = COALESCE(retail_items.unit_of_measure, excluded.unit_of_measure),
         updated_at = excluded.updated_at
       WHERE length(excluded.name) > length(retail_items.name)
          OR (retail_items.manufacturer IS NULL AND excluded.manufacturer IS NOT NULL)
          OR (retail_items.quantity IS NULL AND excluded.quantity IS NOT NULL)
       RETURNING id, item_key`,
      [
        now,
        batch.map((b) => b.itemKey),
        batch.map((b) => b.itemCode),
        batch.map((b) => (b.internal ? chainId : null)),
        batch.map((b) => b.name),
        batch.map((b) => normalizeRetailName(b.name)),
        batch.map((b) => b.manufacturer),
        batch.map((b) => b.quantity),
        batch.map((b) => b.unitQty),
        batch.map((b) => b.unitOfMeasure),
        batch.map((b) => b.isWeighted),
      ],
    )) as { id: number; item_key: string }[];
    for (const r of rows) ids.set(r.item_key, r.id);
    // Unchanged rows aren't RETURNed; look their ids up.
    const missing = batch.map((b) => b.itemKey).filter((k) => !ids.has(k));
    if (missing.length) {
      const found = (await sql.query(`SELECT id, item_key FROM retail_items WHERE item_key = ANY($1::text[])`, [
        missing,
      ])) as { id: number; item_key: string }[];
      for (const r of found) ids.set(r.item_key, r.id);
    }
  }
  return ids;
}

/**
 * Newest PriceFull of each price-enabled branch -> branch_prices, writing only
 * what changed since the last load so frequent runs stay cheap on Neon.
 */
export async function ingestPrices(sql: Sql, chain: ChainConfig, options: IngestOptions = {}) {
  const log = options.log ?? console.log;
  const runId = await startRun(sql, "prices", chain.id, !!options.dryRun);
  let files = 0;
  let rowsUpserted = 0;
  let rowsDeleted = 0;
  try {
    let branches = (await sql`SELECT id, store_code, name,
                                     to_char(price_file_at, 'YYYY-MM-DD HH24:MI:SS') AS price_file_at
                              FROM retail_branches
                              WHERE chain_id = ${chain.id} AND prices_enabled AND is_active`) as {
      id: number;
      store_code: string;
      name: string;
      price_file_at: string | null;
    }[];
    if (options.storeCodes) branches = branches.filter((b) => options.storeCodes!.includes(b.store_code));
    if (branches.length === 0) {
      log(`  ${chain.id}: no price-enabled branches (run --mode=stores first)`);
      await finishRun(sql, runId, { status: "ok", files: 0, rowsUpserted: 0, rowsDeleted: 0 });
      return;
    }

    const refs = await portalAdapter(chain.portal, chain.portalConfig).listPriceFullFiles(
      branches.map((b) => b.store_code),
    );
    const now = israelNow();
    for (const branch of branches) {
      const ref = refs.find((r) => r.storeCode === branch.store_code);
      const label = `${chain.id}/${branch.store_code} ${branch.name}`;
      if (!ref) {
        log(`  ${label}: no PriceFull file listed`);
        continue;
      }
      if (hoursBetween(ref.timestamp, now) > MAX_PRICE_FILE_AGE_HOURS) {
        log(`  ${label}: newest file ${ref.name} is stale, skipped`);
        continue;
      }
      if (!options.force && branch.price_file_at && ref.timestamp <= branch.price_file_at) {
        log(`  ${label}: ${ref.name} already loaded`);
        continue;
      }

      const parsed = parsePriceFullXml(decodePriceFile(await ref.fetch()));
      files++;
      if (parsed.govChainId !== chain.govChainId) {
        throw new Error(`${ref.name} is for chain ${parsed.govChainId}`);
      }
      // The file name is authoritative: it matches the Stores file. Carrefour's
      // former Mega branches carry a truncated legacy id inside (440 -> 297).
      if (parsed.storeCode !== branch.store_code) {
        log(`  ${label}: note: file says StoreID ${parsed.storeCode}, trusting the file name`);
      }
      if (options.dryRun) {
        log(`  ${label}: ${ref.name} -> ${parsed.items.length} items (dry run)`);
        continue;
      }

      const ids = await upsertItems(sql, chain.id, parsed.items);
      // One price per item; the last row wins when a file repeats a code.
      const next = new Map<number, ParsedPriceItem>();
      for (const item of parsed.items) {
        const id = ids.get(itemKeyFor(chain.id, item).itemKey);
        if (id !== undefined) next.set(id, item);
      }
      const current = (await sql`SELECT retail_item_id, price_agorot, unit_price_agorot FROM branch_prices
                                 WHERE branch_id = ${branch.id}`) as {
        retail_item_id: number;
        price_agorot: number;
        unit_price_agorot: number | null;
      }[];
      const currentById = new Map(current.map((r) => [r.retail_item_id, r]));
      const changed = [...next].filter(([id, item]) => {
        const c = currentById.get(id);
        return !c || c.price_agorot !== item.priceAgorot || c.unit_price_agorot !== item.unitPriceAgorot;
      });
      const removed = current.map((r) => r.retail_item_id).filter((id) => !next.has(id));

      const queries = [];
      for (let i = 0; i < changed.length; i += BATCH) {
        const batch = changed.slice(i, i + BATCH);
        queries.push(
          sql.query(
            `INSERT INTO branch_prices (branch_id, retail_item_id, price_agorot, unit_price_agorot, price_updated_at)
             SELECT $1, t.id, t.price, t.unit_price, t.updated_at
             FROM unnest($2::int[], $3::int[], $4::int[], $5::timestamp[]) AS t(id, price, unit_price, updated_at)
             ON CONFLICT (branch_id, retail_item_id) DO UPDATE SET price_agorot = excluded.price_agorot,
               unit_price_agorot = excluded.unit_price_agorot, price_updated_at = excluded.price_updated_at`,
            [
              branch.id,
              batch.map(([id]) => id),
              batch.map(([, item]) => item.priceAgorot),
              batch.map(([, item]) => item.unitPriceAgorot),
              batch.map(([, item]) => item.priceUpdatedAt),
            ],
          ),
        );
      }
      if (removed.length) {
        queries.push(
          sql.query(`DELETE FROM branch_prices WHERE branch_id = $1 AND retail_item_id = ANY($2::int[])`, [
            branch.id,
            removed,
          ]),
        );
      }
      queries.push(
        sql.query(`UPDATE retail_branches SET price_file_at = $1, prices_updated_at = $2, updated_at = $2 WHERE id = $3`, [
          ref.timestamp,
          nowIso(),
          branch.id,
        ]),
      );
      // One atomic batch per branch: a failure leaves the previous prices intact.
      await sql.transaction(queries);
      rowsUpserted += changed.length;
      rowsDeleted += removed.length;
      log(`  ${label}: ${ref.name} -> ${next.size} items, ${changed.length} changed, ${removed.length} removed`);
    }
    await finishRun(sql, runId, { status: "ok", files, rowsUpserted, rowsDeleted });
  } catch (e) {
    await finishRun(sql, runId, { status: "failed", files, rowsUpserted, rowsDeleted, error: String(e) });
    throw e;
  }
}

/** How many price-enabled branches carry each item — ranks refinement options. */
export async function refreshBranchCounts(sql: Sql) {
  await sql`UPDATE retail_items ri SET branch_count = c.n
            FROM (SELECT bp.retail_item_id, count(*)::int AS n
                  FROM branch_prices bp JOIN retail_branches b ON b.id = bp.branch_id
                  WHERE b.prices_enabled GROUP BY bp.retail_item_id) c
            WHERE ri.id = c.retail_item_id AND ri.branch_count <> c.n`;
  await sql`UPDATE retail_items ri SET branch_count = 0
            WHERE ri.branch_count > 0 AND NOT EXISTS (SELECT 1 FROM branch_prices bp WHERE bp.retail_item_id = ri.id)`;
}
