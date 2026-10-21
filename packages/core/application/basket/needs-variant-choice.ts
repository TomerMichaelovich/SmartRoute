import type { ShoppingListItem } from "../../domain/entities/shopping-list";
import { effectiveVariant } from "./effective-variant";

/**
 * Whether the refinement popup should ask "what did you mean by '<item>'?".
 * Not when the shopper already chose, when there's nothing to choose between,
 * or for produce sold by weight (priced per kg: "the cheapest" is the answer).
 * Skipped items are simply priced as "any, cheapest".
 */
export function needsVariantChoice(
  item: ShoppingListItem,
  options: { isWeighted: boolean; isTypical: boolean }[],
): boolean {
  if (effectiveVariant(item)) return false;
  if (options.length < 2) return false;
  if (options.some((o) => o.isTypical && o.isWeighted)) return false;
  return true;
}
