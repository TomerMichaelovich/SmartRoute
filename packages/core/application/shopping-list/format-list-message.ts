import type { ProductCategory } from "../../domain/entities/product";
import type { ShoppingListItem } from "../../domain/entities/shopping-list";
import { CATEGORY_EMOJI, CATEGORY_LABEL_HE, groupByCategory } from "./group-by-category";

/** WhatsApp formatting marks would break the line's own markup (e.g. the ~strikethrough~). */
function plain(text: string): string {
  return text.replace(/[*_~`]/g, "").trim();
}

function itemLabel(item: ShoppingListItem): string {
  const name = plain(item.rawText);
  return item.quantity && item.quantity > 1 ? `${name} ×${item.quantity}` : name;
}

/**
 * The open items in the order the bot numbers them: grouped by supermarket
 * department when `categoryOf` is given, else in list order. "מחק 3" counts
 * in this same order (see matchItemsToRemove).
 */
export function numberedOpenItems(
  items: ShoppingListItem[],
  categoryOf?: (item: ShoppingListItem) => ProductCategory | undefined,
): ShoppingListItem[] {
  const open = items.filter((item) => !item.checked);
  return categoryOf ? groupByCategory(open, categoryOf).flatMap((section) => section.items) : open;
}

/**
 * The list as a WhatsApp message: open items first - split into supermarket
 * departments when `categoryOf` is given - then bought ones struck through
 * (~like this~) so it's clear they were already picked up. Who added an open
 * item is shown when `namesByUserId` knows them.
 */
export function formatListMessage(
  listName: string,
  items: ShoppingListItem[],
  namesByUserId: Record<string, string> = {},
  categoryOf?: (item: ShoppingListItem) => ProductCategory | undefined,
): string {
  if (items.length === 0) return `*${plain(listName)}*\nהרשימה ריקה. שלחו לי מוצרים כדי להוסיף.`;

  const open = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);
  const lines = [`*${plain(listName)}* (${open.length} פתוחים)`];

  const line = (item: ShoppingListItem, n: number) => {
    const by = item.addedByUserId ? namesByUserId[item.addedByUserId] : undefined;
    return by ? `${n}. ${itemLabel(item)} _(${plain(by)})_` : `${n}. ${itemLabel(item)}`;
  };

  // Numbered, so "מחק 3" can point at an item (see matchItemsToRemove).
  let n = 0;
  if (categoryOf) {
    for (const section of groupByCategory(open, categoryOf)) {
      lines.push("", `${CATEGORY_EMOJI[section.category]} *${CATEGORY_LABEL_HE[section.category]}*`);
      for (const item of section.items) lines.push(line(item, ++n));
    }
  } else {
    for (const item of open) lines.push(line(item, ++n));
  }
  if (bought.length > 0) {
    lines.push("", "נקנו:");
    for (const item of bought) lines.push(`✓ ~${itemLabel(item)}~`);
  }
  return lines.join("\n");
}

/** "גזר, חלב ועוד 3" - a short summary of added items for a reply or notification. */
export function summarizeItems(names: string[], max = 4): string {
  const shown = names.slice(0, max).map(plain).join(", ");
  return names.length > max ? `${shown} ועוד ${names.length - max}` : shown;
}
