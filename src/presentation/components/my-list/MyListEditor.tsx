"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/src/domain/entities/product";
import type { ShoppingList, ShoppingListItem } from "@/src/domain/entities/shopping-list";
import { ClassificationReviewRow } from "@/src/presentation/components/classification/ClassificationReviewRow";
import { Button } from "@/src/presentation/components/ui/Button";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";
import { setMyListCode } from "@/src/presentation/lib/my-list-storage";
import { ShareListButton } from "./ShareListButton";

interface MyListEditorProps {
  initialList: ShoppingList;
  products: Product[];
}

export function MyListEditor({ initialList, products }: MyListEditorProps) {
  const router = useRouter();
  const { logEvent } = useAnalytics();
  const shareCode = initialList.shareCode!;
  const [items, setItems] = useState(initialList.items);
  const [updatedAt, setUpdatedAt] = useState(initialList.updatedAt);
  const [newLinesText, setNewLinesText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [staleServerList, setStaleServerList] = useState<ShoppingList | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const updatedAtRef = useRef(updatedAt);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);

  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);

  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    setMyListCode(shareCode);
  }, [shareCode]);

  useEffect(() => {
    async function refetchIfStale() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/lists/${shareCode}`);
        if (!res.ok) return;
        const data: { list: ShoppingList } = await res.json();
        if (data.list.updatedAt === updatedAtRef.current) return;
        if (hasUnsavedChangesRef.current) {
          setStaleServerList(data.list);
        } else {
          setItems(data.list.items);
          setUpdatedAt(data.list.updatedAt);
        }
      } catch {
        // Best-effort background sync - ignore failures.
      }
    }
    document.addEventListener("visibilitychange", refetchIfStale);
    return () => document.removeEventListener("visibilitychange", refetchIfStale);
  }, [shareCode]);

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

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function handleChangeProduct(itemId: string, productId: string | null) {
    const currentItem = items.find((item) => item.id === itemId);
    if (currentItem && productId !== (currentItem.classification?.matchedProductId ?? null)) {
      logEvent(
        "classification_corrected",
        {
          rawText: currentItem.rawText,
          previousProductId: currentItem.classification?.matchedProductId ?? null,
          newProductId: productId,
        },
        { storeId: initialList.storeId },
      );
    }
    setHasUnsavedChanges(true);
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

  function handleRemove(itemId: string) {
    setHasUnsavedChanges(true);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  const newRawLines = newLinesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function handleSave(force = false) {
    setIsSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const payload = [
        ...items,
        ...newRawLines.map((rawText) => ({ rawText })),
      ];
      const res = await fetch(`/api/lists/${shareCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, expectedUpdatedAt: updatedAt, force }),
      });
      if (res.status === 409) {
        const body: { current: ShoppingList } = await res.json();
        setStaleServerList(body.current);
        setIsSaving(false);
        return;
      }
      if (!res.ok) throw new Error("save failed");
      const saved: ShoppingList = await res.json();
      setItems(saved.items);
      setUpdatedAt(saved.updatedAt);
      setNewLinesText("");
      setHasUnsavedChanges(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError(he.common.error);
    } finally {
      setIsSaving(false);
    }
  }

  function handleLoadLatest() {
    if (!staleServerList) return;
    setItems(staleServerList.items);
    setUpdatedAt(staleServerList.updatedAt);
    setStaleServerList(null);
    setHasUnsavedChanges(false);
  }

  const unresolvedCount = items.filter((item: ShoppingListItem) => !item.classification?.matchedProductId).length;

  async function handleGenerateRoute() {
    setIsGeneratingRoute(true);
    setError(null);
    try {
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: initialList.storeId, shoppingListId: initialList.id, items }),
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
        setIsGeneratingRoute(false);
        return;
      }
      const route: { id: string } = await res.json();
      router.push(`/route/${route.id}`);
    } catch {
      setError(he.common.error);
      setIsGeneratingRoute(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ShareListButton shareCode={shareCode} />

      {staleServerList && (
        <div className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
          <p>{he.myList.editor.staleTitle}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleLoadLatest}>
              {he.myList.editor.loadLatest}
            </Button>
            <Button variant="ghost" onClick={() => handleSave(true)} disabled={isSaving}>
              {he.myList.editor.saveAnyway}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ClassificationReviewRow
            key={item.id}
            item={item}
            productsByDepartment={productsByDepartment}
            productById={productById}
            onChangeProduct={handleChangeProduct}
            onRemove={handleRemove}
          />
        ))}
      </div>

      <textarea
        value={newLinesText}
        onChange={(e) => {
          setNewLinesText(e.target.value);
          setHasUnsavedChanges(true);
        }}
        placeholder={he.myList.editor.addItemsPlaceholder}
        rows={3}
        dir="rtl"
        className="w-full resize-none rounded-2xl border border-neutral-200 bg-white p-4 text-base leading-7 focus:border-cyan-500 focus:outline-none"
      />

      {unresolvedCount > 0 && (
        <p className="text-sm text-amber-700">{he.review.unresolvedWarning(unresolvedCount)}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={() => handleSave(false)} disabled={isSaving} fullWidth>
        {isSaving ? he.common.loading : justSaved ? he.myList.editor.saved : he.myList.editor.save}
      </Button>
      <Button
        variant="secondary"
        onClick={handleGenerateRoute}
        disabled={isGeneratingRoute || items.length === 0}
        fullWidth
      >
        {isGeneratingRoute ? he.common.loading : he.review.continueToRoute}
      </Button>
    </div>
  );
}
