import type { ClassificationResult } from "../../domain/entities/classification-result";
import type { ShoppingListItem } from "../../domain/entities/shopping-list";

export type RemoveMatch =
  | { kind: "found"; items: ShoppingListItem[] }
  | { kind: "ambiguous"; items: ShoppingListItem[] }
  | { kind: "none" };

/** Loose comparison form: no niqqud, quotes or extra spaces, lowercase. */
function normalize(text: string): string {
  return text
    .replace(/[֑-ׇ]/g, "")
    .replace(/["'״׳]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Open (not yet bought) items, in the order the bot numbers them in "רשימה". */
export function openItems(items: ShoppingListItem[]): ShoppingListItem[] {
  return items.filter((item) => !item.checked);
}

/**
 * Which item(s) "מחק <target>" means. A number is the item's position in the
 * bot's numbered list; text matches the name exactly (every copy), else by
 * part of the name - more than one partial match means "which one?".
 */
export function matchItemsToRemove(
  items: ShoppingListItem[],
  target: string,
  /** The open items in the order the bot numbered them (default: list order). */
  numbered: ShoppingListItem[] = openItems(items),
): RemoveMatch {
  const trimmed = target.trim();
  if (/^\d{1,3}$/.test(trimmed)) {
    const item = numbered[Number(trimmed) - 1];
    return item ? { kind: "found", items: [item] } : { kind: "none" };
  }

  const wanted = normalize(trimmed);
  if (!wanted) return { kind: "none" };
  const exact = items.filter((item) => normalize(item.rawText) === wanted);
  if (exact.length > 0) return { kind: "found", items: exact };

  const partial = items.filter((item) => {
    const name = normalize(item.rawText);
    return name.includes(wanted) || wanted.includes(name);
  });
  if (partial.length === 1) return { kind: "found", items: partial };
  if (partial.length > 1) return { kind: "ambiguous", items: partial };
  return { kind: "none" };
}

/** An open item with exactly this name (ignoring niqqud, quotes, spacing, case) - "already on the list". */
export function findOpenItemByName(items: ShoppingListItem[], name: string): ShoppingListItem | null {
  const wanted = normalize(name);
  if (!wanted) return null;
  return openItems(items).find((item) => normalize(item.rawText) === wanted) ?? null;
}

/** Two lines name the same thing: the same catalog product, or the same imported-products alias. */
export function sameProduct(a: ClassificationResult | undefined, b: ClassificationResult | undefined): boolean {
  if (a?.matchedProductId && b?.matchedProductId) return a.matchedProductId === b.matchedProductId;
  if (a?.matchedAlias && b?.matchedAlias) return a.matchedAlias === b.matchedAlias;
  return false;
}

/**
 * An open item a newly sent line repeats: the same name, or recognized as the same
 * product ("חלב" and "חלב 3%" both read as milk) - "already on the list".
 */
export function findOpenDuplicate(
  items: ShoppingListItem[],
  rawText: string,
  classification?: ClassificationResult,
): ShoppingListItem | null {
  return (
    findOpenItemByName(items, rawText) ??
    openItems(items).find((item) => sameProduct(item.classification, classification)) ??
    null
  );
}
