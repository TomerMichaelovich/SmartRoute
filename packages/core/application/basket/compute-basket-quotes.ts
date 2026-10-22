/**
 * Ranks branches by what the shopper's list would cost there.
 *
 * A branch missing items must not win just because it's missing them: each
 * missing item is charged at that item's median price across the compared
 * branches, giving every branch a comparable full-basket price to rank by
 * (shown as an estimate when items are missing).
 */

export interface BasketRequirement {
  itemId: string;
  rawText: string;
  quantity: number;
  /** Priced per kg (weighted produce) or similar: the total is an estimate. */
  estimated: boolean;
}

export interface PricedLine {
  itemKey: string;
  name: string;
  /** Price of one unit (or one kg for weighted produce). */
  priceAgorot: number;
  /** Set when found only in another pack size: priceAgorot is then its per-unit share, this the shelf price. */
  packPriceAgorot?: number;
  scaled?: boolean;
}

export interface QuoteLine extends PricedLine {
  itemId: string;
  quantity: number;
  lineTotalAgorot: number;
}

export interface BasketQuote<B> {
  branch: B;
  /** What the items this branch sells cost there. */
  totalAgorot: number;
  /** totalAgorot plus each missing item at its median price elsewhere: what branches are ranked by. */
  fullBasketAgorot: number;
  estimated: boolean;
  missingItems: { itemId: string; rawText: string; estimatedAgorot: number }[];
  lines: QuoteLine[];
}

export interface BasketQuoteResult<B> {
  quotes: BasketQuote<B>[];
  /** Requirements no compared branch sells at all — not counted against anyone. */
  unavailableEverywhere: { itemId: string; rawText: string }[];
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function computeBasketQuotes<B extends { id: number; distanceKm: number | null }>(input: {
  requirements: BasketRequirement[];
  branches: B[];
  /** branch id -> item id -> the cheapest acceptable product there. */
  prices: Map<number, Map<string, PricedLine>>;
  limit: number;
}): BasketQuoteResult<B> {
  const { requirements, branches, prices, limit } = input;

  const lineTotal = (req: BasketRequirement, line: PricedLine) => Math.round(line.priceAgorot * req.quantity);
  const medianByItem = new Map<string, number>();
  const unavailableEverywhere: { itemId: string; rawText: string }[] = [];
  const comparable: BasketRequirement[] = [];
  for (const req of requirements) {
    const totals = branches
      .map((b) => prices.get(b.id)?.get(req.itemId))
      .filter((line): line is PricedLine => line !== undefined)
      .map((line) => lineTotal(req, line));
    if (totals.length === 0) {
      unavailableEverywhere.push({ itemId: req.itemId, rawText: req.rawText });
    } else {
      medianByItem.set(req.itemId, median(totals));
      comparable.push(req);
    }
  }

  const scored = branches.map((branch) => {
    const branchPrices = prices.get(branch.id);
    const lines: QuoteLine[] = [];
    const missingItems: { itemId: string; rawText: string; estimatedAgorot: number }[] = [];
    let score = 0;
    let estimated = false;
    for (const req of comparable) {
      const line = branchPrices?.get(req.itemId);
      if (line) {
        const total = lineTotal(req, line);
        lines.push({ ...line, itemId: req.itemId, quantity: req.quantity, lineTotalAgorot: total });
        score += total;
        estimated ||= req.estimated;
      } else {
        const estimatedAgorot = medianByItem.get(req.itemId)!;
        missingItems.push({ itemId: req.itemId, rawText: req.rawText, estimatedAgorot });
        score += estimatedAgorot;
      }
    }
    const totalAgorot = lines.reduce((sum, l) => sum + l.lineTotalAgorot, 0);
    return { quote: { branch, totalAgorot, fullBasketAgorot: score, estimated, missingItems, lines }, score };
  });

  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.quote.missingItems.length - b.quote.missingItems.length ||
      (a.quote.branch.distanceKm ?? Infinity) - (b.quote.branch.distanceKm ?? Infinity),
  );
  return { quotes: scored.slice(0, limit).map((s) => s.quote), unavailableEverywhere };
}
