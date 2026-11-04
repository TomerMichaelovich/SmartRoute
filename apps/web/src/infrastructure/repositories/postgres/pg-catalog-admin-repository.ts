import { and, asc, count, eq, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { Product } from "@smartroute/core/domain/entities/product";
import { db, rawSql } from "../../db/client";
import { products } from "../../db/schema";
import type {
  AdminProductQuery,
  AliasProduct,
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

// regexp_replace arguments dropping a geresh/gershayim (or the quotes typed for them).
const WITHOUT_GERESH = `'[''׳"״]', '', 'g'`;

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

  async aliasProducts(storeId: string, normalizedAliases: string[]): Promise<AliasProduct[]> {
    if (normalizedAliases.length === 0) return [];
    const rows = (await rawSql.query(
      // A stored alias is normalized with its geresh as a space ("ג'ין" -> "ג ין"): "גין"
      // is matched against the aliases as written, without one.
      `WITH carried AS (${CARRIED_BY_STORE} AND (p.normalized_aliases ?| $2::text[] OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(p.aliases) AS a(alias)
         WHERE regexp_replace(a.alias, ${WITHOUT_GERESH}) = ANY($2::text[]))))
       SELECT DISTINCT ON (pr.id) pr.id, pr.canonical_name, pr.aliases, pr.source_item_key, l.node_id
       FROM carried c JOIN products pr ON pr.id = c.id
       LEFT JOIN product_listings l ON l.store_id = $1 AND l.product_id = pr.id
       ORDER BY pr.id`,
      [storeId, normalizedAliases],
    )) as Record<string, unknown>[];
    return rows
      .map((r) => ({
        id: String(r.id),
        canonicalName: String(r.canonical_name),
        aliases: (r.aliases as string[] | null) ?? [],
        sourceItemKey: (r.source_item_key as string | null) ?? null,
        nodeId: (r.node_id as string | null) ?? null,
      }))
      .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "he"));
  }

  async aliasSuggestions(storeId: string, text: string, limit: number) {
    const contains = likePattern(text.replace(/['׳"״]/g, ""));
    const rows = (await rawSql.query(
      `WITH carried AS (${CARRIED_BY_STORE})
       SELECT a.alias, count(DISTINCT pr.id)::int AS products
       FROM carried c JOIN products pr ON pr.id = c.id
       CROSS JOIN LATERAL jsonb_array_elements_text(pr.aliases) AS a(alias)
       WHERE regexp_replace(a.alias, ${WITHOUT_GERESH}) LIKE $2
       GROUP BY a.alias
       ORDER BY bool_or(regexp_replace(a.alias, ${WITHOUT_GERESH}) LIKE $3) DESC, products DESC, a.alias
       LIMIT $4`,
      // Starting with the text: the same pattern without its leading wildcard.
      [storeId, contains, contains.slice(1), limit],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({ alias: String(r.alias), products: Number(r.products) }));
  }

  async aliasPlacements(storeId: string, aliases: string[]) {
    if (aliases.length === 0) return [];
    const rows = (await rawSql.query(
      `SELECT a.alias, l.node_id, count(DISTINCT l.product_id)::int AS n
       FROM product_listings l JOIN products p ON p.id = l.product_id
       CROSS JOIN LATERAL jsonb_array_elements_text(p.aliases) AS a(alias)
       WHERE l.store_id = $1 AND a.alias = ANY($2::text[])
       GROUP BY a.alias, l.node_id`,
      [storeId, aliases],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({ alias: String(r.alias), nodeId: String(r.node_id), count: Number(r.n) }));
  }

  async splitAliases(storeId: string) {
    const rows = (await rawSql.query(
      `WITH placed AS (
         SELECT a.alias, l.node_id, count(DISTINCT l.product_id)::int AS n
         FROM product_listings l JOIN products p ON p.id = l.product_id
         CROSS JOIN LATERAL jsonb_array_elements_text(p.aliases) AS a(alias)
         WHERE l.store_id = $1
         GROUP BY a.alias, l.node_id)
       SELECT alias, json_agg(json_build_object('nodeId', node_id, 'count', n) ORDER BY n DESC) AS nodes
       FROM placed GROUP BY alias HAVING count(*) > 1
       ORDER BY alias`,
      [storeId],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      alias: String(r.alias),
      nodes: (r.nodes as Array<{ nodeId: string; count: number }>).map((n) => ({
        nodeId: String(n.nodeId),
        count: Number(n.count),
      })),
    }));
  }

  async aliasProductIdsAtNode(storeId: string, nodeId: string, alias: string): Promise<string[]> {
    const rows = (await rawSql.query(
      `SELECT l.product_id FROM product_listings l JOIN products p ON p.id = l.product_id
       WHERE l.store_id = $1 AND l.node_id = $2 AND p.aliases ? $3`,
      [storeId, nodeId, alias],
    )) as Record<string, unknown>[];
    return rows.map((r) => String(r.product_id));
  }

  async groupProductsAtNode(storeId: string, nodeId: string, groupId: string) {
    const rows = (await rawSql.query(
      `SELECT p.id, p.canonical_name, p.aliases, p.source_item_key FROM product_listings l JOIN products p ON p.id = l.product_id
       WHERE l.store_id = $1 AND l.node_id = $2 AND p.shelf_group = $3
       ORDER BY p.canonical_name`,
      [storeId, nodeId, groupId],
    )) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      canonicalName: String(r.canonical_name),
      aliases: (r.aliases as string[] | null) ?? [],
      sourceItemKey: (r.source_item_key as string | null) ?? null,
    }));
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
      `SELECT p.id, p.canonical_name, p.department, p.shelf_group, p.aliases, p.normalized_aliases,
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
      aliases: (r.aliases as string[] | null) ?? [],
      normalizedAliases: r.normalized_aliases as string[],
      imported: Boolean(r.imported),
      carried: Boolean(r.carried),
      excluded: Boolean(r.excluded),
    }));
    return rankSearchHits(hits, normalizedText).slice(0, limit);
  }

  async searchProducts(query: AdminProductQuery): Promise<{ products: Product[]; total: number }> {
    // Chain-internal keys are "<chainId>:<code>"; only the code is compared.
    const code = query.barcode?.replace(/^0+/, "");
    const where = and(
      query.imported ? isNotNull(products.sourceItemKey) : isNull(products.sourceItemKey),
      or(
        query.text ? sql`${products.normalizedAliases}::text LIKE ${likePattern(query.text)}` : undefined,
        code
          ? sql`(ltrim(regexp_replace(${products.sourceItemKey}, '^.*:', ''), '0') = ${code}
              OR ${products.id} IN (SELECT s.product_id FROM product_sku_links s
                WHERE NOT s.is_rejected AND ltrim(regexp_replace(s.item_key, '^.*:', ''), '0') = ${code}))`
          : undefined,
      ),
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
