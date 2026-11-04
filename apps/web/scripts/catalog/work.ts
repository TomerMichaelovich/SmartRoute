import { existsSync, mkdirSync, readdirSync, readFileSync } from "fs";
import path from "path";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { BranchItem } from "@/src/infrastructure/catalog/catalog-import";

/**
 * The enrichment work area of one branch:
 *   scripts/catalog/work/<chain>-<store>/in/chunk-NNN.jsonl   items to enrich (export-branch-items)
 *   scripts/catalog/work/<chain>-<store>/out/chunk-NNN.json   what enrichment wrote for them
 * See ENRICH_RULES.md for how an out file is written.
 */

export function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

export function requiredArg(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`--${name}=... is required`);
  return value;
}

export function workDir(chain: string, storeCode: string) {
  const root = path.join("scripts", "catalog", "work", `${chain}-${storeCode}`);
  const dirs = { root, in: path.join(root, "in"), out: path.join(root, "out") };
  mkdirSync(dirs.in, { recursive: true });
  mkdirSync(dirs.out, { recursive: true });
  return dirs;
}

export interface Chunk {
  id: string;
  inPath: string;
  outPath: string;
}

export function listChunks(dirs: ReturnType<typeof workDir>): Chunk[] {
  return readdirSync(dirs.in)
    .filter((f) => /^chunk-\d+\.jsonl$/.test(f))
    .sort()
    .map((f) => {
      const id = f.slice("chunk-".length, -".jsonl".length);
      return { id, inPath: path.join(dirs.in, f), outPath: path.join(dirs.out, `chunk-${id}.json`) };
    });
}

export function readChunkInput(chunk: Chunk): BranchItem[] {
  return readFileSync(chunk.inPath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as BranchItem);
}

export function readChunkOutput(chunk: Chunk): unknown {
  if (!existsSync(chunk.outPath)) return undefined;
  return JSON.parse(readFileSync(chunk.outPath, "utf8"));
}

/** Every item in the branch's latest price file. */
export async function loadBranchItems(sql: NeonQueryFunction<false, false>, chain: string, storeCode: string): Promise<BranchItem[]> {
  const rows = await sql`
    SELECT ri.item_key, ri.name, ri.manufacturer, ri.quantity, ri.unit_qty, ri.is_weighted
    FROM retail_branches b
    JOIN branch_prices bp ON bp.branch_id = b.id
    JOIN retail_items ri ON ri.id = bp.retail_item_id
    WHERE b.chain_id = ${chain} AND b.store_code = ${storeCode}`;
  return rows.map((r) => ({
    itemKey: r.item_key as string,
    name: r.name as string,
    manufacturer: (r.manufacturer as string | null) || null,
    quantity: r.quantity as number | null,
    unitQty: (r.unit_qty as string | null) || null,
    isWeighted: r.is_weighted as boolean,
  }));
}

/** The branch, and its chain as an import needs it: the linked mapped store's chain_id and the chain's brand name. */
export async function loadBranch(sql: NeonQueryFunction<false, false>, chain: string, storeCode: string) {
  const [row] = await sql`
    SELECT b.id, b.name, b.price_file_at, s.chain_id AS navio_chain_id, c.name AS brand_name
    FROM retail_branches b
    JOIN retail_chains c ON c.id = b.chain_id
    LEFT JOIN stores s ON s.id = b.navio_store_id
    WHERE b.chain_id = ${chain} AND b.store_code = ${storeCode}`;
  if (!row) throw new Error(`no retail branch ${chain}/${storeCode}`);
  if (!row.navio_chain_id) throw new Error(`branch ${chain}/${storeCode} isn't linked to a mapped NAVIO store`);
  return {
    name: row.name as string,
    priceFileAt: row.price_file_at as string | null,
    chain: { navioChainId: row.navio_chain_id as string, brandName: row.brand_name as string },
  };
}
