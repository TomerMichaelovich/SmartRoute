import { findSkuCandidates, type CandidateItem } from "@/src/infrastructure/prices/sku-candidates";
import { verifySkuCandidatesByRules } from "@/src/infrastructure/prices/sku-rules";
import { verifySkuCandidates, type SkuVerdict } from "@/src/infrastructure/prices/sku-verifier";
import { connect } from "./db";

/**
 * Links generic products ("חלב") to the retail SKUs a shopper could mean by them
 * (product_sku_links) — the options of the refinement popup and the basis of
 * basket pricing.
 *
 * Candidates come from whole-word name matching (sku-candidates.ts), then a
 * verifier decides match / typical / label per candidate:
 *   --verifier=rules   (default) free word rules (sku-rules.ts). Cheap, so every
 *                      run re-evaluates and updates its own rows.
 *   --verifier=claude  Claude (sku-verifier.ts, needs ANTHROPIC_API_KEY). Each
 *                      pair is verified once; rules rows are upgraded, and
 *                      rejections are kept so re-runs skip them.
 * Rows an admin decided (source "manual") are never touched.
 *
 * Usage: tsx scripts/prices/link-skus.ts [--verifier=rules|claude] [--product=<id>[,<id>]]
 *                                        [--limit=<n>] [--dry-run] [--prod]
 */

const CLAUDE_CONCURRENCY = 4;

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
}

type ProductRow = { id: string; canonical_name: string; normalized_aliases: string[]; department: string };

async function main() {
  const verifier = arg("verifier") ?? "rules";
  if (verifier !== "rules" && verifier !== "claude") throw new Error(`unknown --verifier=${verifier}`);
  const dryRun = process.argv.includes("--dry-run");
  const productIds = arg("product")?.split(",");
  const limit = arg("limit") ? Number(arg("limit")) : Infinity;
  const { sql, target } = connect();
  console.log(`[${target}] link-skus verifier=${verifier}${dryRun ? " (dry run)" : ""}`);

  const items: CandidateItem[] = (
    (await sql`SELECT id, item_key, name, normalized_name, manufacturer, quantity, unit_qty, is_weighted, branch_count
               FROM retail_items WHERE branch_count > 0`) as Record<string, never>[]
  ).map((r) => ({
    id: r.id,
    itemKey: r.item_key,
    name: r.name,
    normalizedName: r.normalized_name,
    manufacturer: r.manufacturer,
    quantity: r.quantity,
    unitQty: r.unit_qty,
    isWeighted: r.is_weighted,
    branchCount: r.branch_count,
  }));
  // Chain-exclusive products (private labels) are left out for now: their
  // stores.chain_id isn't mapped to the retail chains yet.
  const allProducts = (await sql`SELECT id, canonical_name, normalized_aliases, department FROM products
                                 WHERE is_active AND chain_id IS NULL ORDER BY canonical_name`) as ProductRow[];
  const candidatesOf = new Map(allProducts.map((p) => [p.id, findSkuCandidates(p.normalized_aliases, items)]));
  // item key -> the longest alias (in words) any product matches it by, and which product.
  const claims = new Map<string, { productId: string; words: number }[]>();
  for (const [productId, cands] of candidatesOf) {
    for (const c of cands) {
      if (!c.startsWithAlias || c.viaFallback) continue;
      claims.set(c.itemKey, [...(claims.get(c.itemKey) ?? []), { productId, words: c.matchedWords }]);
    }
  }
  const moreSpecificElsewhere = (productId: string) => (itemKey: string, words: number) =>
    (claims.get(itemKey) ?? []).some((cl) => cl.productId !== productId && cl.words > words);
  const products = productIds ? allProducts.filter((p) => productIds.includes(p.id)) : allProducts;

  // Pairs this verifier must leave alone: admin decisions always; for Claude
  // also pairs it already verified.
  const lockedSources = ["manual", "llm"];
  const locked = new Set(
    (
      (await sql`SELECT product_id, item_key FROM product_sku_links WHERE source = ANY(${lockedSources})`) as {
        product_id: string;
        item_key: string;
      }[]
    ).map((r) => `${r.product_id}|${r.item_key}`),
  );

  const work = products
    .map((p) => ({
      product: p,
      candidates: candidatesOf.get(p.id)!.filter((c) => !locked.has(`${p.id}|${c.itemKey}`)),
    }))
    .filter((w) => w.candidates.length > 0)
    .slice(0, limit);
  console.log(`${items.length} items, ${products.length} products, ${work.length} with candidates to verify`);

  const source = verifier === "rules" ? "rules" : "llm";
  let done = 0;
  let linked = 0;
  let typical = 0;
  let failed = 0;

  const process1 = async ({ product, candidates }: (typeof work)[number]) => {
    let verdicts: SkuVerdict[];
    if (verifier === "rules") {
      verdicts = verifySkuCandidatesByRules(
        { canonicalName: product.canonical_name, normalizedAliases: product.normalized_aliases, department: product.department },
        candidates,
        moreSpecificElsewhere(product.id),
      );
    } else {
      // The shortest alias is the most generic thing a shopper writes ("חלב").
      const genericTerm = [...product.normalized_aliases].sort((a, b) => a.length - b.length)[0] ?? product.canonical_name;
      verdicts = await verifySkuCandidates(
        { canonicalName: product.canonical_name, genericTerm, department: product.department },
        candidates,
      );
    }
    const matches = verdicts.filter((v) => v.match);
    linked += matches.length;
    typical += matches.filter((v) => v.typical).length;
    if (dryRun) {
      console.log(`\n${product.canonical_name}: ${matches.length}/${candidates.length} match`);
      const byKey = new Map(candidates.map((c) => [c.itemKey, c]));
      for (const v of verdicts.slice(0, 14)) {
        console.log(`   ${v.match ? (v.typical ? "★" : "✓") : "✗"} ${byKey.get(v.itemKey)?.name}  →  ${v.label}`);
      }
      return;
    }
    if (verdicts.length === 0) return;
    const score = new Map(candidates.map((c) => [c.itemKey, c.score]));
    await sql.query(
      `INSERT INTO product_sku_links (product_id, item_key, source, score, is_typical, is_rejected, variant_label, updated_at)
       SELECT $1, t.item_key, $2, t.score, t.typical, NOT t.match, t.label, $3
       FROM unnest($4::text[], $5::real[], $6::bool[], $7::bool[], $8::text[]) AS t(item_key, score, typical, match, label)
       ON CONFLICT (product_id, item_key) DO UPDATE SET
         source = excluded.source, score = excluded.score, is_typical = excluded.is_typical,
         is_rejected = excluded.is_rejected, variant_label = excluded.variant_label, updated_at = excluded.updated_at
       WHERE product_sku_links.source NOT IN ('manual', 'llm')`,
      [
        product.id,
        source,
        new Date().toISOString(),
        verdicts.map((v) => v.itemKey),
        verdicts.map((v) => score.get(v.itemKey) ?? 0),
        verdicts.map((v) => v.typical),
        verdicts.map((v) => v.match),
        verdicts.map((v) => v.label),
      ],
    );
  };

  const queue = [...work];
  const worker = async () => {
    for (let w = queue.shift(); w; w = queue.shift()) {
      try {
        await process1(w);
      } catch (e) {
        failed++;
        console.error(`  ${w.product.canonical_name}: FAILED — ${e instanceof Error ? e.message : String(e)}`);
      }
      done++;
      if (done % 50 === 0) console.log(`  ... ${done}/${work.length}`);
    }
  };
  await Promise.all(Array.from({ length: verifier === "claude" ? CLAUDE_CONCURRENCY : 1 }, worker));
  console.log(`done: ${done} products, ${linked} links (${typical} typical), ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
