import type { ShoppingListItem } from "../../domain/entities/shopping-list";

/** WhatsApp formatting marks would break the line's own markup (e.g. the ~strikethrough~). */
function plain(text: string): string {
  return text.replace(/[*_~`]/g, "").trim();
}

function itemLabel(item: ShoppingListItem): string {
  const name = plain(item.rawText);
  return item.quantity && item.quantity > 1 ? `${name} ×${item.quantity}` : name;
}

/**
 * The list as a WhatsApp message: open items first, then bought ones struck
 * through (~like this~) so it's clear they were already picked up. Who added
 * an open item is shown when `namesByUserId` knows them.
 */
export function formatListMessage(
  listName: string,
  items: ShoppingListItem[],
  namesByUserId: Record<string, string> = {},
): string {
  if (items.length === 0) return `*${plain(listName)}*\nהרשימה ריקה. שלחו לי מוצרים כדי להוסיף.`;

  const open = items.filter((item) => !item.checked);
  const bought = items.filter((item) => item.checked);
  const lines = [`*${plain(listName)}* (${open.length} פתוחים)`];

  // Numbered, so "מחק 3" can point at an item (see matchItemsToRemove).
  open.forEach((item, i) => {
    const by = item.addedByUserId ? namesByUserId[item.addedByUserId] : undefined;
    lines.push(by ? `${i + 1}. ${itemLabel(item)} _(${plain(by)})_` : `${i + 1}. ${itemLabel(item)}`);
  });
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
