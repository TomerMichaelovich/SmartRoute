import { sql } from "drizzle-orm";
import { db } from "../../db/client";
import type { IPriceRepository, SkuLinkView } from "../interfaces/price-repository";

export class PgPriceRepository implements IPriceRepository {
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
