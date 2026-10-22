import { sql } from "drizzle-orm";
import { db, rawSql } from "../../db/client";
import type {
  CheapestPriceRow,
  IPriceRepository,
  PriceBranch,
  RequirementKey,
  SkuLinkView,
  SkuOption,
} from "../interfaces/price-repository";

export class PgPriceRepository implements IPriceRepository {
  async findSkuOptions(productIds: string[]): Promise<Map<string, SkuOption[]>> {
    const out = new Map<string, SkuOption[]>();
    if (productIds.length === 0) return out;
    const rows = (await rawSql.query(
      `SELECT l.product_id, l.item_key, ri.name, l.variant_label, ri.manufacturer, l.is_typical, ri.is_weighted, ri.branch_count
       FROM product_sku_links l JOIN retail_items ri ON ri.item_key = l.item_key
       WHERE l.product_id = ANY($1::text[]) AND NOT l.is_rejected AND ri.branch_count > 0
       ORDER BY l.product_id, l.is_typical DESC, ri.branch_count DESC, l.score DESC, ri.name`,
      [productIds],
    )) as Record<string, unknown>[];
    for (const r of rows) {
      const productId = String(r.product_id);
      const list = out.get(productId) ?? [];
      list.push({
        itemKey: String(r.item_key),
        name: String(r.name),
        label: (r.variant_label as string | null) ?? null,
        manufacturer: (r.manufacturer as string | null) ?? null,
        isTypical: Boolean(r.is_typical),
        isWeighted: Boolean(r.is_weighted),
        branchCount: Number(r.branch_count),
      });
      out.set(productId, list);
    }
    return out;
  }

  async findPriceCities(): Promise<{ cityCode: number; branchCount: number }[]> {
    const rows = (await rawSql.query(
      `SELECT city_code, count(*)::int AS n FROM retail_branches
       WHERE prices_enabled AND is_active AND is_retail AND city_code IS NOT NULL AND price_file_at IS NOT NULL
       GROUP BY city_code ORDER BY n DESC`,
    )) as { city_code: number; n: number }[];
    return rows.map((r) => ({ cityCode: Number(r.city_code), branchCount: Number(r.n) }));
  }

  async findBranchesInCity(cityCode: number, maxPriceAgeHours: number): Promise<PriceBranch[]> {
    // price_file_at is the Israel-local time from the file name.
    const rows = (await rawSql.query(
      `SELECT b.id, b.chain_id, c.name AS chain_name, b.name, b.address, b.city_code, b.lat, b.lng, b.navio_store_id,
              to_char(b.price_file_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS price_file_at
       FROM retail_branches b JOIN retail_chains c ON c.id = b.chain_id
       WHERE b.city_code = $1 AND b.prices_enabled AND b.is_active AND b.is_retail
         AND b.price_file_at > (now() AT TIME ZONE 'Asia/Jerusalem') - make_interval(hours => $2)`,
      [cityCode, maxPriceAgeHours],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: Number(r.id),
      chainId: String(r.chain_id),
      chainName: String(r.chain_name),
      name: String(r.name),
      address: (r.address as string | null) ?? null,
      cityCode: Number(r.city_code),
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      navioStoreId: (r.navio_store_id as string | null) ?? null,
      priceFileAt: String(r.price_file_at),
    }));
  }

  async findCheapestPrices(branchIds: number[], requirements: { id: string; keys: RequirementKey[] }[]): Promise<CheapestPriceRow[]> {
    const rowsIn = requirements.flatMap((r) => r.keys.map((k) => ({ reqId: r.id, ...k })));
    if (branchIds.length === 0 || rowsIn.length === 0) return [];
    const rows = (await rawSql.query(
      `WITH req AS (
         SELECT * FROM unnest($1::text[], $2::text[], $3::float8[], $4::int[]) AS r(req_id, item_key, factor, tier)
       )
       SELECT DISTINCT ON (bp.branch_id, req.req_id)
              bp.branch_id, req.req_id, ri.item_key, ri.name, bp.price_agorot, req.tier,
              round(bp.price_agorot * req.factor)::int AS effective
       FROM req
       JOIN retail_items ri ON ri.item_key = req.item_key
       JOIN branch_prices bp ON bp.retail_item_id = ri.id AND bp.branch_id = ANY($5::int[])
       ORDER BY bp.branch_id, req.req_id, req.tier, bp.price_agorot * req.factor, ri.item_key`,
      [
        rowsIn.map((r) => r.reqId),
        rowsIn.map((r) => r.itemKey),
        rowsIn.map((r) => r.factor),
        rowsIn.map((r) => r.tier),
        branchIds,
      ],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      branchId: Number(r.branch_id),
      requirementId: String(r.req_id),
      itemKey: String(r.item_key),
      name: String(r.name),
      priceAgorot: Number(r.effective),
      packPriceAgorot: Number(r.price_agorot),
      scaled: Number(r.tier) === 1,
    }));
  }

  async findSkuLinks(productId: string): Promise<SkuLinkView[]> {
    const result = await db.execute(sql`
      SELECT l.item_key, ri.name, ri.manufacturer, l.variant_label, l.source, l.is_typical, l.is_rejected, l.score,
             ri.branch_count,
             (SELECT min(bp.price_agorot) FROM branch_prices bp WHERE bp.retail_item_id = ri.id) AS min_price,
             (SELECT max(bp.price_agorot) FROM branch_prices bp WHERE bp.retail_item_id = ri.id) AS max_price
      FROM product_sku_links l
      JOIN retail_items ri ON ri.item_key = l.item_key
      WHERE l.product_id = ${productId}
      ORDER BY l.is_rejected, l.is_typical DESC, l.score DESC, ri.name`);
    return (result.rows as Record<string, unknown>[]).map((r) => ({
      itemKey: String(r.item_key),
      name: String(r.name),
      manufacturer: (r.manufacturer as string | null) ?? null,
      variantLabel: (r.variant_label as string | null) ?? null,
      source: r.source as SkuLinkView["source"],
      isTypical: Boolean(r.is_typical),
      isRejected: Boolean(r.is_rejected),
      score: Number(r.score),
      branchCount: Number(r.branch_count),
      minPriceAgorot: r.min_price === null ? null : Number(r.min_price),
      maxPriceAgorot: r.max_price === null ? null : Number(r.max_price),
    }));
  }

  async updateSkuLink(productId: string, itemKey: string, patch: { isRejected?: boolean; isTypical?: boolean }) {
    // Rejecting also clears "typical"; making typical also un-rejects.
    const isRejected = patch.isTypical ? false : patch.isRejected;
    const isTypical = patch.isRejected ? false : patch.isTypical;
    await db.execute(sql`
      UPDATE product_sku_links SET
        source = 'manual',
        is_rejected = COALESCE(${isRejected ?? null}::boolean, is_rejected),
        is_typical = COALESCE(${isTypical ?? null}::boolean, is_typical),
        updated_at = ${new Date().toISOString()}
      WHERE product_id = ${productId} AND item_key = ${itemKey}`);
  }
}
