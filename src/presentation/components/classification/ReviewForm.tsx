"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Product } from "@/src/domain/entities/product";
import type { ShoppingListItem } from "@/src/domain/entities/shopping-list";
import { Button } from "@/src/presentation/components/ui/Button";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";
import { ClassificationReviewRow } from "./ClassificationReviewRow";

interface ReviewFormProps {
  storeId: string;
  shoppingListId: string;
  initialItems: ShoppingListItem[];
  products: Product[];
}

export function ReviewForm({
  storeId,
  shoppingListId,
  initialItems,
  products,
}: ReviewFormProps) {
  const router = useRouter();
  const { logEvent } = useAnalytics();
  const [items, setItems] = useState(initialItems);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productsByDepartment = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const list = map.get(p.department) ?? [];
      list.push(p);
      map.set(p.department, list);
    }
    return Array.from(map.entries()).map(([department, departmentProducts]) => ({
      department,
      products: departmentProducts,
    }));
  }, [products]);

  function handleChangeProduct(itemId: string, productId: string | null) {
    // Log outside the updater: setState updaters must stay pure (React
    // Strict Mode double-invokes them in dev specifically to catch side
    // effects like this, which would otherwise double-log the event).
    const currentItem = items.find((item) => item.id === itemId);
    if (currentItem && productId !== (currentItem.classification?.matchedProductId ?? null)) {
      logEvent(
        "classification_corrected",
        {
          rawText: currentItem.rawText,
          previousProductId: currentItem.classification?.matchedProductId ?? null,
          newProductId: productId,
        },
        { storeId },
      );
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!productId) {
          return {
            ...item,
            classification: { rawText: item.rawText, confidence: 0, source: "unresolved" },
          };
        }
        return {
          ...item,
          classification: {
            rawText: item.rawText,
            matchedProductId: productId,
            confidence: 1,
            source: item.classification?.source ?? "unresolved",
          },
        };
      }),
    );
  }

  const unresolvedCount = items.filter((item) => !item.classification?.matchedProductId).length;

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, shoppingListId, items }),
      });
      if (!res.ok) {
        const body: { code?: string } | null = await res.json().catch(() => null);
        setError(
          body?.code === "missing_entrance_or_checkout"
            ? he.review.missingEntranceOrCheckout
            : body?.code === "disconnected_graph"
              ? he.review.disconnectedGraph
              : he.common.error,
        );
        setIsSubmitting(false);
        return;
      }
      const route: { id: string } = await res.json();
      router.push(`/route/${route.id}`);
    } catch {
      setError(he.common.error);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ClassificationReviewRow
            key={item.id}
            item={item}
            productsByDepartment={productsByDepartment}
            onChangeProduct={handleChangeProduct}
          />
        ))}
      </div>
      {unresolvedCount > 0 && (
        <p className="text-sm text-amber-700">{he.review.unresolvedWarning(unresolvedCount)}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button onClick={handleSubmit} disabled={isSubmitting} fullWidth>
        {isSubmitting ? he.common.loading : he.review.continueToRoute}
      </Button>
    </div>
  );
}
