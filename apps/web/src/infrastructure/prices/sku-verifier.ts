import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ScoredCandidate } from "./sku-candidates";

/**
 * Verifies candidate SKUs for one generic product with Claude (offline, from
 * scripts/prices/link-skus). Decides, per candidate, whether a shopper who wrote
 * the product's generic name would accept it, whether it's the typical pick,
 * and a short label that tells the options apart in the refinement popup.
 */

const MODEL = "claude-opus-5";

const SYSTEM_PROMPT = `You match Israeli supermarket products (Hebrew names from price-transparency files) to a generic shopping-list item.

A shopper wrote a generic item on their list. For each candidate product, decide:
- "match": would a shopper who wrote the generic term accept this product as what they meant? It must be the same kind of product. Reject products that merely contain the word: for "חלב" reject שוקולד חלב, חלבה, חלב קוקוס, משקה חלב בטעם; for fresh "עגבניות" reject canned/crushed tomatoes and sauces. Different brands, sizes, fat levels and pack counts of the same product all match.
- "typical": does it fit the specific product described by the canonical name (same type, fat %, size class)? Brand may differ unless the canonical name is defined by the brand itself. When the canonical name is just the generic term, typical = the ordinary everyday version (not flavoured, organic, mini or bulk variants).
- "label": a short Hebrew label (max ~25 chars) that tells this option apart from the others, built from the distinguishing facts in the name: brand, %, size, flavour, pack. Example: "תנובה · 3% · 1 ל'". Don't repeat the generic term.

Retail names are abbreviated and sometimes truncated; read them charitably.`;

const VerdictSchema = z.object({
  results: z.array(
    z.object({
      i: z.number().int(),
      match: z.boolean(),
      typical: z.boolean(),
      label: z.string(),
    }),
  ),
});

export type SkuVerdict = { itemKey: string; match: boolean; typical: boolean; label: string };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

function describe(c: ScoredCandidate, i: number): string {
  const qty = c.quantity && c.unitQty ? ` | ${c.quantity} ${c.unitQty}` : "";
  const weighted = c.isWeighted ? " | נמכר במשקל" : "";
  return `${i}. ${c.name}${c.manufacturer ? ` | ${c.manufacturer}` : ""}${qty}${weighted}`;
}

export async function verifySkuCandidates(
  product: { canonicalName: string; genericTerm: string; department: string },
  candidates: ScoredCandidate[],
): Promise<SkuVerdict[]> {
  if (candidates.length === 0) return [];
  const prompt = `Generic term the shopper wrote: "${product.genericTerm}"
Canonical product name: "${product.canonicalName}"
Department: ${product.department}

Candidates:
${candidates.map(describe).join("\n")}

Return one result per candidate, using its number as "i".`;

  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    // A short classification task: low effort keeps cost and latency down.
    output_config: { effort: "low", format: betaZodOutputFormat(VerdictSchema) },
    betas: ["server-side-fallback-2026-06-01"],
    fallbacks: [{ model: "claude-opus-4-8" }],
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") throw new Error(`refused: ${product.canonicalName}`);
  if (response.stop_reason === "max_tokens") throw new Error(`truncated: ${product.canonicalName}`);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(`unparseable verdict for ${product.canonicalName}`);

  const verdicts: SkuVerdict[] = [];
  for (const r of parsed.results) {
    const c = candidates[r.i];
    if (!c) continue;
    verdicts.push({ itemKey: c.itemKey, match: r.match, typical: r.match && r.typical, label: r.label.trim().slice(0, 60) });
  }
  return verdicts;
}
