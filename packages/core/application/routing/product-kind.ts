import type { PackForm, ShoppingListItem, ShoppingListItemKindChoice } from "@smartroute/core/domain/entities/shopping-list";
import { findShelfGroup } from "@smartroute/core/domain/value-objects/shelf-group";
import { normalizeHebrewText } from "../classification/normalize-hebrew-text";

/**
 * The kinds of product one line can mean, in words a shopper picks from: really different
 * products ("חומוס": spread, canned, dry, frozen), or, when they're all one product, its
 * packaging ("קולה": bottle, can, six-pack). Read from what's already known about each
 * imported product: its shelf group and its name.
 */

export interface KindProduct {
  canonicalName: string;
  shelfGroup?: string | null;
}

/** One button: `groups` (and `form`, for packaging) say which products it stands for. */
export interface LineKind {
  groups: string[];
  form?: PackForm;
  label: string;
  products: number;
}

const MAX_KINDS = 4;
const FORM_ORDER: PackForm[] = ["single", "can", "sixpack", "pack"];

// What a shelf group is called next to the line's other kinds; otherwise its own name.
const GROUP_LABELS: Record<string, string> = {
  "chilled-salads-dips": "ממרח או סלט",
  "canned-legumes": "שימורים",
  "canned-fish": "שימורים",
  "canned-vegetables": "שימורים",
  "canned-fruit": "שימורים",
  "canned-ready-meals": "שימורים",
  "legumes-grains": "יבש",
  "tahini-halva": "גולמית",
  "fresh-milk": "טרי",
  "long-life-milk": "עמיד",
  "packaged-bread": "ארוז ופרוס",
  "fresh-bread": "טרי מהמאפייה",
  "gluten-free": "ללא גלוטן",
  "pasta-noodles": "יבשה",
  "instant-meals": "מנה חמה",
  "baby-food": "לתינוקות",
  "yellow-cheese": "ארוזה",
  "deli-counter": "מהמעדנייה",
  "white-cheese": "לבנה",
  "salty-cheese": "מלוחה",
  "specialty-cheese": "משובחת",
  "fresh-poultry": "טרי",
  "fresh-fish": "טרי",
  "fresh-ground-meat-kebab": "טרי",
  "smoked-pickled-fish": "מעושן",
  vegetables: "טרי",
  fruits: "טרי",
};

const BOTTLED_GROUPS = new Set(["soft-drinks", "water", "soda-water", "beer", "wine", "spirits"]);

const SIX_PACK = /שישי|(?:^|\s)6\s*(?:[xX*×]|פחיות|בקבוקים|יחידות)|[xX*×]\s*6(?:\s|$)/;
const MULTIPACK = /מארז|רביעי|שישי|\d\s*[xX*×]\s*\d/;
const DRINK_COUNT = /\d+\s*(?:יחידות|פחיות|בקבוקים)/;

const isDrink = (group: string | null | undefined) => findShelfGroup(group ?? "")?.department === "משקאות";

export function packForm(product: KindProduct): PackForm {
  const name = product.canonicalName;
  // Off the drinks shelves a count is what's in the box ("ביצים 12 יחידות"), not a multipack.
  if (!isDrink(product.shelfGroup)) return MULTIPACK.test(name) ? "pack" : "single";
  if (SIX_PACK.test(name)) return "sixpack";
  if (MULTIPACK.test(name) || DRINK_COUNT.test(name)) return "pack";
  return /פחי/.test(name) ? "can" : "single";
}

function groupLabel(group: string): string {
  const known = GROUP_LABELS[group];
  if (known) return known;
  const shelf = findShelfGroup(group);
  if (shelf?.department === "קפואים") return "קפוא";
  return (shelf?.name ?? group).split(/[,(]/)[0].trim();
}

function formLabel(form: PackForm, group: string | null | undefined): string {
  if (form === "can") return "פחית";
  if (form === "sixpack") return "שישייה";
  if (form === "pack") return "מארז";
  if (!isDrink(group)) return "יחידה";
  return BOTTLED_GROUPS.has(group ?? "") ? "בקבוק" : "בודד";
}

function formPlural(form: PackForm, group: string | null | undefined): string {
  if (form === "can") return "פחיות";
  if (form === "sixpack") return "שישיות";
  if (form === "pack") return "מארזים";
  return BOTTLED_GROUPS.has(group ?? "") ? "בקבוקים" : "יחידות";
}

/** The buttons for a line answered by these products; none when there's nothing to tell apart. */
export function lineKinds(products: KindProduct[]): LineKind[] {
  const placed = products.filter((p): p is KindProduct & { shelfGroup: string } => !!p.shelfGroup);
  const byLabel = new Map<string, { groups: Set<string>; products: number }>();
  for (const product of placed) {
    const label = groupLabel(product.shelfGroup);
    const kind = byLabel.get(label) ?? { groups: new Set<string>(), products: 0 };
    kind.groups.add(product.shelfGroup);
    kind.products++;
    byLabel.set(label, kind);
  }
  if (byLabel.size >= 2) {
    return [...byLabel]
      .map(([label, kind]) => ({ groups: [...kind.groups], label, products: kind.products }))
      .sort((a, b) => b.products - a.products)
      .slice(0, MAX_KINDS);
  }
  if (byLabel.size === 0) return [];

  const groups = [...new Set(placed.map((p) => p.shelfGroup))];
  const counts = new Map<PackForm, number>();
  for (const product of placed) {
    const form = packForm(product);
    counts.set(form, (counts.get(form) ?? 0) + 1);
  }
  // A lone can of cola is a real choice; one odd multipack of rice isn't worth a button.
  const least = groups.some(isDrink) ? 1 : 2;
  const forms = FORM_ORDER.filter((form) => (counts.get(form) ?? 0) >= least);
  if (forms.length < 2) return [];
  return forms.map((form) => ({ groups, form, label: formLabel(form, groups[0]), products: counts.get(form)! }));
}

/** The line already says its packaging ("שישיית קולה", "קולה בפחית"): nothing to offer. */
export function lineNamesPack(normalized: string): boolean {
  return /(?:^|\s)ב?(?:שישי|מארז|פחי|בקבוק)/.test(normalized);
}

export function matchesKind(product: KindProduct | undefined, kind: Pick<ShoppingListItemKindChoice, "groups" | "form">): boolean {
  if (!product?.shelfGroup || !kind.groups.includes(product.shelfGroup)) return false;
  return !kind.form || packForm(product) === kind.form;
}

/** The item's tapped kind, unless the item was edited since. */
export function effectiveKindChoice(item: ShoppingListItem): ShoppingListItemKindChoice | null {
  const choice = item.kindChoice;
  return choice && choice.text === normalizeHebrewText(item.rawText) ? choice : null;
}

/**
 * What sets one place apart from the item's other places ("שישיות", "שימורים"), for naming
 * it on the map. Undefined when it holds a mix, or the same as the others.
 */
export function placeKindLabel(here: KindProduct[], elsewhere: KindProduct[]): string | undefined {
  const hereProducts = here.filter((p) => p.shelfGroup);
  const otherProducts = elsewhere.filter((p) => p.shelfGroup);
  if (hereProducts.length === 0 || otherProducts.length === 0) return undefined;

  const hereLabels = new Set(hereProducts.map((p) => groupLabel(p.shelfGroup!)));
  if (hereLabels.size > 1) return undefined;
  const [label] = hereLabels;
  if (otherProducts.some((p) => groupLabel(p.shelfGroup!) !== label)) return label;

  const hereForms = new Set(hereProducts.map(packForm));
  if (hereForms.size > 1) return undefined;
  const [form] = hereForms;
  if (otherProducts.every((p) => packForm(p) === form)) return undefined;
  return formPlural(form, hereProducts[0].shelfGroup);
}
