"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { Button } from "@/src/presentation/components/ui/Button";
import { he } from "@smartroute/core/i18n/he";

const POLL_MS = 4000;

interface SharedListEditorProps {
  initialList: ShoppingList;
  store: Store | null;
  productNameById: Record<string, string>;
}

export function SharedListEditor({ initialList, store, productNameById }: SharedListEditorProps) {
  const router = useRouter();
  const code = initialList.shareCode!;
  const [items, setItems] = useState<ShoppingListItem[]>(initialList.items);
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // While > 0 a local mutation is in flight; the poller must not overwrite.
  const pending = useRef(0);

  const refetch = useCallback(async () => {
    if (pending.current > 0) return;
    try {
      const res = await fetch(`/api/lists/${code}`);
      if (!res.ok) return;
      const data: { list: ShoppingList } = await res.json();
      if (pending.current === 0) setItems(data.list.items);
    } catch {
      // best-effort background sync
    }
  }, [code]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    const interval = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refetch]);

  async function mutate(run: () => Promise<Response>) {
    pending.current += 1;
    setSyncing(true);
    setError(null);
    try {
      const res = await run();
      if (!res.ok) throw new Error(String(res.status));
      const data: { list: ShoppingList | null } = await res.json();
      if (data.list) setItems(data.list.items);
    } catch {
      setError(he.common.error);
      void refetch();
    } finally {
      pending.current -= 1;
      if (pending.current === 0) setSyncing(false);
    }
  }

  async function handleAdd() {
    const lines = newText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((rawText) => ({ rawText }));
    if (lines.length === 0) return;
    setAdding(true);
    setNewText("");
    await mutate(() =>
      fetch(`/api/lists/${code}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      }),
    );
    setAdding(false);
  }

  function patchItem(itemId: string, patch: Record<string, unknown>, optimistic: (it: ShoppingListItem) => ShoppingListItem) {
    setItems((prev) => prev.map((it) => (it.id === itemId ? optimistic(it) : it)));
    void mutate(() =>
      fetch(`/api/lists/${code}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
  }

  function toggleChecked(item: ShoppingListItem) {
    const checked = !item.checked;
    patchItem(item.id, { checked }, (it) => ({ ...it, checked }));
  }

  function changeQty(item: ShoppingListItem, delta: number) {
    const next = Math.max(1, (item.quantity ?? 1) + delta);
    patchItem(item.id, { quantity: next }, (it) => ({ ...it, quantity: next }));
  }

  function remove(itemId: string) {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    void mutate(() => fetch(`/api/lists/${code}/items/${itemId}`, { method: "DELETE" }));
  }

  async function handleGenerateRoute() {
    setGenerating(true);
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
        setGenerating(false);
        return;
      }
      const route: { id: string } = await res.json();
      router.push(`/route/${route.id}`);
    } catch {
      setError(he.common.error);
      setGenerating(false);
    }
  }

  const collected = items.filter((it) => it.checked).length;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>{store?.name}</span>
        <span>
          {items.length > 0 && he.household.sharedList.collected(collected, items.length)}
          {syncing ? ` · ${he.household.sharedList.syncing}` : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">{he.household.sharedList.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white">
          {items.map((item) => {
            const name =
              (item.classification?.matchedProductId &&
                productNameById[item.classification.matchedProductId]) ||
              item.rawText;
            return (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={Boolean(item.checked)}
                  onChange={() => toggleChecked(item)}
                  className="size-5 shrink-0 accent-cyan-600"
                  aria-label={name}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={
                      "truncate text-sm " +
                      (item.checked ? "text-neutral-400 line-through" : "text-neutral-900")
                    }
                  >
                    {name}
                  </span>
                  {item.checked && item.checkedByName && (
                    <span className="text-xs text-neutral-400">
                      {he.household.sharedList.collectedBy(item.checkedByName)}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => changeQty(item, -1)}
                    className="size-6 rounded-full border border-neutral-300 text-neutral-600"
                    aria-label="-"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-sm tabular-nums">{item.quantity ?? 1}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(item, 1)}
                    className="size-6 rounded-full border border-neutral-300 text-neutral-600"
                    aria-label="+"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="pr-1 text-xs text-red-600"
                  >
                    {he.household.sharedList.remove}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <textarea
        value={newText}
        onChange={(e) => setNewText(e.target.value)}
        placeholder={he.household.sharedList.addPlaceholder}
        rows={2}
        dir="rtl"
        className="w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-base leading-7 focus:border-cyan-500 focus:outline-none"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button onClick={handleAdd} disabled={adding || !newText.trim()} fullWidth>
        {adding ? he.common.loading : he.household.sharedList.addButton}
      </Button>
      <Button
        variant="secondary"
        onClick={handleGenerateRoute}
        disabled={generating || items.length === 0}
        fullWidth
      >
        {generating ? he.common.loading : he.review.continueToRoute}
      </Button>
    </div>
  );
}
