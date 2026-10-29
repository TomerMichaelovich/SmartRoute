import { rawSql } from "../../db/client";
import type { IImportedCatalogRepository } from "../interfaces/imported-catalog-repository";
import type { SkuOption } from "../interfaces/price-repository";

export class PgImportedCatalogRepository implements IImportedCatalogRepository {
  async skuOptionsByAlias(normalizedTexts: string[]): Promise<Map<string, SkuOption[]>> {
    const out = new Map<string, SkuOption[]>();
    if (normalizedTexts.length === 0) return out;
    const rows = (await rawSql.query(
      `SELECT a.alias, ri.item_key, ri.name, ri.manufacturer, ri.is_weighted, ri.branch_count
       FROM products p
       CROSS JOIN LATERAL jsonb_array_elements_text(p.normalized_aliases) AS a(alias)
       JOIN retail_items ri ON ri.item_key = p.source_item_key
       WHERE p.is_active AND p.source_item_key IS NOT NULL AND ri.branch_count > 0 AND a.alias = ANY($1::text[])
       ORDER BY ri.branch_count DESC, ri.name`,
      [normalizedTexts],
    )) as Record<string, unknown>[];
    for (const r of rows) {
      const options = out.get(String(r.alias)) ?? [];
      if (options.some((o) => o.itemKey === r.item_key)) continue;
      options.push({
        itemKey: String(r.item_key),
        name: String(r.name),
        label: null,
        manufacturer: (r.manufacturer as string | null) ?? null,
        // Every imported product answering to the text is as typical as the next.
        isTypical: true,
        isWeighted: Boolean(r.is_weighted),
        branchCount: Number(r.branch_count),
      });
      out.set(String(r.alias), options);
    }
    return out;
  }
}
