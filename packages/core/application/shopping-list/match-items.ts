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
export function matchItemsToRemove(items: ShoppingListItem[], target: string): RemoveMatch {
  const trimmed = target.trim();
  if (/^\d{1,3}$/.test(trimmed)) {
    const item = openItems(items)[Number(trimmed) - 1];
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
