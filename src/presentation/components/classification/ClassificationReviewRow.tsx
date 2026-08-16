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
  onChangeProduct: (itemId: string, productId: string | null) => void;
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
  onChangeProduct,
}: ClassificationReviewRowProps) {
  const badge = confidenceBadge(item);
  const selectedProductId = item.classification?.matchedProductId ?? "";

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-neutral-900">{item.rawText}</span>
        {badge && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>
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
    </div>
  );
}
