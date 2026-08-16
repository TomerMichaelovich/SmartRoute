"use client";

import { useState } from "react";
import type { Route } from "@/src/domain/entities/route";
import type { ShoppingList } from "@/src/domain/entities/shopping-list";
import { Button } from "@/src/presentation/components/ui/Button";

interface AdminRoutePreviewProps {
  storeId: string;
}

/**
 * Calls the same /api/classify + /api/routes endpoints the customer flow
 * uses, then embeds the real /route/[routeId] page (the one a phone would
 * load) rather than reimplementing its map/checklist rendering here - any
 * hand-rolled re-render would drift from the actual customer screen (missed
 * progress bar, progressive route reveal, promotions, etc). previewMode=1
 * keeps this from creating a fake analytics session or writing real events.
 */
export function AdminRoutePreview({ storeId }: AdminRoutePreviewProps) {
  const [text, setText] = useState("");
  const [route, setRoute] = useState<Route | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handlePreview() {
    const rawItems = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (rawItems.length === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const classifyRes = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rawItems }),
      });
      if (!classifyRes.ok) throw new Error("classify failed");
      const shoppingList: ShoppingList = await classifyRes.json();

      const routesRes = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          shoppingListId: shoppingList.id,
          items: shoppingList.items,
        }),
      });
      if (!routesRes.ok) throw new Error("route build failed");
      const builtRoute: Route = await routesRes.json();

      setRoute(builtRoute);
    } catch {
      setError("שגיאה ביצירת המסלול לתצוגה מקדימה");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        dir="rtl"
        placeholder="הדביקו רשימת פריטים לבדיקה, פריט בכל שורה"
        className="rounded-xl border border-neutral-300 bg-white p-3"
      />
      <Button type="button" onClick={handlePreview} disabled={isLoading}>
        {isLoading ? "בונה מסלול..." : "בנה מסלול לתצוגה מקדימה"}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {route && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              מרחק: {Math.round(route.totalDistanceMeters)} · חזרות: {route.backtrackCount} · לא
              זוהו: {route.unresolvedItemIds.length}
            </p>
            <a
              href={`/route/${route.id}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-emerald-700 underline"
            >
              פתח בטאב חדש
            </a>
          </div>
          <div className="mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-300 shadow-sm">
            <iframe
              key={route.id}
              src={`/route/${route.id}?preview=1`}
              title="תצוגה מקדימה כמו בנייד"
              className="h-[720px] w-full"
            />
          </div>
        </div>
      )}
    </div>
  );
}
