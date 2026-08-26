import { useState } from "react";
import type { Product } from "@/src/domain/entities/product";
import type { ShoppingListItem } from "@/src/domain/entities/shopping-list";
import { he } from "@/src/presentation/i18n/he";

interface ProductGroup {
  department: string;
  products: Product[];
}

interface ClassificationReviewRowProps {
  item: ShoppingListItem;
  productsByDepartment: ProductGroup[];
  productById: Map<string, Product>;
  onChangeProduct: (itemId: string, productId: string | null) => void;
  onRemove?: (itemId: string) => void;
}

function confidenceBadge(item: ShoppingListItem): { label: string; className: string } | null {
  const c = item.classification;
  if (!c || !c.matchedProductId || c.source === "unresolved") {
    return { label: he.review.notFound, className: "bg-red-50 text-red-700" };
  }
  if (c.availableAtStore === false) {
    return { label: he.review.outOfStock, className: "bg-red-50 text-red-700" };
  }
  if (c.confidence < 0.85) {
    return { label: he.review.checkThis, className: "bg-amber-50 text-amber-700" };
  }
  return null;
}

export function ClassificationReviewRow({
  item,
  productsByDepartment,
  productById,
  onChangeProduct,
  onRemove,
}: ClassificationReviewRowProps) {
  const badge = confidenceBadge(item);
  const selectedProductId = item.classification?.matchedProductId ?? "";
  // alternativeMatches is computed against the whole catalog, but this row can only offer
  // products the store actually carries (productById is pre-filtered to those) - anything
  // else would silently fail to route to, same as picking from the full dropdown would.
  const suggestions = (item.classification?.alternativeMatches ?? [])
    .filter((alt) => productById.has(alt.productId))
    .slice(0, 3);
  const [showFullList, setShowFullList] = useState(suggestions.length === 0);

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-neutral-900">{item.rawText}</span>
        <div className="flex shrink-0 items-center gap-2">
          {badge && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={he.myList.editor.removeItem}
              className="text-neutral-400"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-neutral-500">{he.review.suggestionsLabel}</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((alt) => {
              const product = productById.get(alt.productId)!;
              const isSelected = selectedProductId === alt.productId;
              return (
                <button
                  key={alt.productId}
                  type="button"
                  onClick={() => onChangeProduct(item.id, alt.productId)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                    isSelected
                      ? "border-cyan-500 bg-cyan-50 text-cyan-700"
                      : "border-neutral-200 bg-neutral-50 text-neutral-900"
                  }`}
                >
                  {product.canonicalName}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {suggestions.length > 0 && !showFullList ? (
        <button
          type="button"
          onClick={() => setShowFullList(true)}
          className="self-start text-sm text-neutral-500 underline"
        >
          {he.review.showFullList}
        </button>
      ) : (
        <select
          value={selectedProductId}
          onChange={(e) => onChangeProduct(item.id, e.target.value || null)}
          aria-label={he.review.chooseProduct}
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-sm text-neutral-900"
        >
          <option value="">{he.review.noMatch}</option>
          {productsByDepartment.map((group) => (
            <optgroup key={group.department} label={group.department}>
              {group.products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.canonicalName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
