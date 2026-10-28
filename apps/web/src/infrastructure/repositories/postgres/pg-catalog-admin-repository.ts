import { and, asc, count, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Product } from "@smartroute/core/domain/entities/product";
import { db, rawSql } from "../../db/client";
import { products } from "../../db/schema";
import type {
  AdminProductQuery,
  ICatalogAdminRepository,
  ProductSearchHit,
  StoreShelfGroup,
} from "../interfaces/catalog-admin-repository";
import { productSchema } from "../schemas";

/**
 * Products (by id) in the price file of the branch linked to store $1 - less those the
 * admin marked as not actually sold there.
 */
const CARRIED_BY_STORE = `
  SELECT p.id, p.shelf_group FROM products p
  JOIN retail_items ri ON ri.item_key = p.source_item_key
  JOIN branch_prices bp ON bp.retail_item_id = ri.id
  JOIN retail_branches b ON b.id = bp.branch_id
  WHERE b.navio_store_id = $1 AND p.is_active
    AND NOT EXISTS (SELECT 1 FROM store_excluded_products x WHERE x.store_id = $1 AND x.product_id = p.id)`;

// Search candidates are fetched by a plain LIKE on the aliases, then ranked in code.
const SEARCH_CANDIDATES = 300;

function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function toDomain(row: typeof products.$inferSelect): Product {
  return productSchema.parse({ ...row, imageUrl: row.imageUrl ?? undefined });
}

export class PgCatalogAdminRepository implements ICatalogAdminRepository {
  async hasPriceBranch(storeId: string): Promise<boolean> {
    const rows = (await rawSql.query(`SELECT 1 FROM retail_branches WHERE navio_store_id = $1 LIMIT 1`, [storeId])) as unknown[];
    return rows.length > 0;
  }

  async shelfGroupsForStore(storeId: string): Promise<StoreShelfGroup[]> {
    const [carriedRows, placedRows] = (await Promise.all([
      rawSql.query(
        `WITH carried AS (${CARRIED_BY_STORE} AND p.shelf_group IS NOT NULL)
         SELECT c.shelf_group, count(*)::int AS carried,
                count(*) FILTER (WHERE NOT EXISTS (
                  SELECT 1 FROM product_listings l WHERE l.store_id = $1 AND l.product_id = c.id))::int AS unplaced
         FROM carried c GROUP BY c.shelf_group`,
        [storeId],
      ),
      rawSql.query(
        `SELECT p.shelf_group, l.node_id, count(*)::int AS n
         FROM product_listings l JOIN products p ON p.id = l.product_id
         WHERE l.store_id = $1 AND p.shelf_group IS NOT NULL
         GROUP BY p.shelf_group, l.node_id`,
        [storeId],
      ),
    ])) as Record<string, unknown>[][];

    const groups = new Map<string, StoreShelfGroup>();
    const group = (groupId: string) => {
      let entry = groups.get(groupId);
      if (!entry) groups.set(groupId, (entry = { groupId, carried: 0, unplaced: 0, nodes: [] }));
      return entry;
    };
    for (const r of carriedRows) {
      const entry = group(String(r.shelf_group));
      entry.carried = Number(r.carried);
      entry.unplaced = Number(r.unplaced);
    }
    for (const r of placedRows) group(String(r.shelf_group)).nodes.push({ nodeId: String(r.node_id), count: Number(r.n) });
    return [...groups.values()];
  }

  async unplacedGroupProductIds(storeId: string, groupId: string): Promise<string[]> {
    const rows = (await rawSql.query(
      `${CARRIED_BY_STORE} AND p.shelf_group = $2
       AND NOT EXISTS (SELECT 1 FROM product_listings l WHERE l.store_id = $1 AND l.product_id = p.id)`,
      [storeId, groupId],
    )) as Record<string, unknown>[];
    return rows.map((r) => String(r.id));
  }

  async groupProductsAtNode(storeId: string, nodeId: string, groupId: string) {
    const rows = (await rawSql.query(
      `SELECT p.id, p.canonical_name FROM product_listings l JOIN products p ON p.id = l.product_id
       WHERE l.store_id = $1 AND l.node_id = $2 AND p.shelf_group = $3
       ORDER BY p.canonical_name`,
      [storeId, nodeId, groupId],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({ id: String(r.id), canonicalName: String(r.canonical_name) }));
  }

  async listedHandMadeProducts(storeId: string): Promise<Product[]> {
    const rows = await db
      .select()
      .from(products)
      .where(
        and(
          isNull(products.sourceItemKey),
          sql`EXISTS (SELECT 1 FROM product_listings l WHERE l.store_id = ${storeId} AND l.product_id = ${products.id})`,
        ),
      );
    return rows.map(toDomain);
  }

  async searchUnlisted(storeId: string, normalizedText: string, limit: number): Promise<ProductSearchHit[]> {
    if (!normalizedText) return [];
    const rows = (await rawSql.query(
      `SELECT p.id, p.canonical_name, p.department, p.shelf_group, p.normalized_aliases,
              p.source_item_key IS NOT NULL AS imported,
              EXISTS (SELECT 1 FROM retail_items ri
                      JOIN branch_prices bp ON bp.retail_item_id = ri.id
                      JOIN retail_branches b ON b.id = bp.branch_id
                      WHERE ri.item_key = p.source_item_key AND b.navio_store_id = $1) AS carried,
              EXISTS (SELECT 1 FROM store_excluded_products x WHERE x.store_id = $1 AND x.product_id = p.id) AS excluded
       FROM products p
       WHERE p.is_active AND p.normalized_aliases::text LIKE $2
         AND NOT EXISTS (SELECT 1 FROM product_listings l WHERE l.store_id = $1 AND l.product_id = p.id)
       LIMIT ${SEARCH_CANDIDATES}`,
      [storeId, likePattern(normalizedText)],
    )) as Record<string, unknown>[];
    const hits: ProductSearchHit[] = rows.map((r) => ({
      id: String(r.id),
      canonicalName: String(r.canonical_name),
      department: String(r.department),
      shelfGroup: (r.shelf_group as string | null) ?? null,
      normalizedAliases: r.normalized_aliases as string[],
      imported: Boolean(r.imported),
      carried: Boolean(r.carried),
      excluded: Boolean(r.excluded),
    }));
    return rankSearchHits(hits, normalizedText).slice(0, limit);
  }

  async searchProducts(query: AdminProductQuery): Promise<{ products: Product[]; total: number }> {
    const where = and(
      query.imported ? isNotNull(products.sourceItemKey) : isNull(products.sourceItemKey),
      query.text ? sql`${products.normalizedAliases}::text LIKE ${likePattern(query.text)}` : undefined,
      query.department ? eq(products.department, query.department) : undefined,
      query.shelfGroup ? eq(products.shelfGroup, query.shelfGroup) : undefined,
    );
    const [rows, [{ total }]] = await Promise.all([
      db.select().from(products).where(where).orderBy(asc(products.canonicalName)).offset(query.offset).limit(query.limit),
      db.select({ total: count() }).from(products).where(where),
    ]);
    return { products: rows.map(toDomain), total };
  }

  async excludedProducts(storeId: string) {
    const rows = (await rawSql.query(
      `SELECT p.id, p.canonical_name, p.shelf_group FROM store_excluded_products x
       JOIN products p ON p.id = x.product_id
       WHERE x.store_id = $1 ORDER BY p.canonical_name`,
      [storeId],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      canonicalName: String(r.canonical_name),
      shelfGroup: (r.shelf_group as string | null) ?? null,
    }));
  }

  async setExcluded(storeId: string, productIds: string[], excluded: boolean): Promise<void> {
    if (productIds.length === 0) return;
    if (excluded) {
      await rawSql.query(
        `INSERT INTO store_excluded_products (store_id, product_id, created_at)
         SELECT $1, unnest($2::text[]), now() ON CONFLICT DO NOTHING`,
        [storeId, productIds],
      );
    } else {
      await rawSql.query(`DELETE FROM store_excluded_products WHERE store_id = $1 AND product_id = ANY($2::text[])`, [
        storeId,
        productIds,
      ]);
    }
  }

  async departments(imported: boolean): Promise<string[]> {
    const rows = await db
      .selectDistinct({ department: products.department })
      .from(products)
      .where(imported ? isNotNull(products.sourceItemKey) : isNull(products.sourceItemKey))
      .orderBy(asc(products.department));
    return rows.map((r) => r.department);
  }
}

/**
 * Best matches first: a name/alias that starts with the text, then a word that does,
 * then one containing it. Among equals, hand-made products and products the store's
 * branch carries come before imported ones it doesn't.
 */
export function rankSearchHits(hits: ProductSearchHit[], normalizedText: string): ProductSearchHit[] {
  const matchRank = (hit: ProductSearchHit) => {
    let rank = Infinity;
    for (const alias of hit.normalizedAliases) {
      if (alias.startsWith(normalizedText)) rank = Math.min(rank, 0);
      else if (alias.split(" ").some((word) => word.startsWith(normalizedText))) rank = Math.min(rank, 1);
      else if (alias.includes(normalizedText)) rank = Math.min(rank, 2);
    }
    return rank;
  };
  const sourceRank = (hit: ProductSearchHit) => (hit.imported && !hit.carried ? 1 : 0);
  return hits
    .map((hit) => ({ hit, rank: matchRank(hit) }))
    .filter(({ rank }) => rank !== Infinity)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        sourceRank(a.hit) - sourceRank(b.hit) ||
        a.hit.canonicalName.localeCompare(b.hit.canonicalName, "he"),
    )
    .map(({ hit }) => hit);
}
