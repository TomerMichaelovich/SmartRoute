"use client";

import { useState } from "react";
import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { Route } from "@/src/domain/entities/route";
import type { ShoppingList } from "@/src/domain/entities/shopping-list";
import { Checklist, type ChecklistStopView } from "@/src/presentation/components/checklist/Checklist";
import { StoreMap } from "@/src/presentation/components/map/StoreMap";
import { Button } from "@/src/presentation/components/ui/Button";

interface AdminRoutePreviewProps {
  storeId: string;
  mapWidth: number;
  mapHeight: number;
  nodes: MapNode[];
  edges: MapEdge[];
}

/**
 * Deliberately calls the same /api/classify + /api/routes endpoints the
 * customer flow uses, rather than reimplementing route-building here - an
 * admin previewing a store's graph/product data is exercising the exact
 * pipeline a shopper would hit, which is the point of a sanity-check tool.
 */
export function AdminRoutePreview({
  storeId,
  mapWidth,
  mapHeight,
  nodes,
  edges,
}: AdminRoutePreviewProps) {
  const [text, setText] = useState("");
  const [route, setRoute] = useState<Route | null>(null);
  const [stopViews, setStopViews] = useState<ChecklistStopView[]>([]);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
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

      const itemById = new Map(shoppingList.items.map((item) => [item.id, item]));
      const views: ChecklistStopView[] = builtRoute.stops.map((stop) => ({
        stop,
        items: stop.itemIds.map((id) => ({
          id,
          displayName: itemById.get(id)?.rawText ?? id,
        })),
      }));

      setRoute(builtRoute);
      setStopViews(views);
      setCheckedItemIds(new Set());
    } catch {
      setError("שגיאה ביצירת המסלול לתצוגה מקדימה");
    } finally {
      setIsLoading(false);
    }
  }

  function toggleItem(itemId: string) {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
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
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            מרחק: {route.totalDistanceMeters} מ&apos; · חזרות: {route.backtrackCount} · לא זוהו:{" "}
            {route.unresolvedItemIds.length}
          </p>
          <StoreMap
            mapWidth={mapWidth}
            mapHeight={mapHeight}
            nodes={nodes}
            edges={edges}
            pathNodeIds={route.pathNodeIds}
            stops={route.stops}
            checkedStopOrders={new Set()}
            selectedStopOrder={null}
          />
          <Checklist
            stopViews={stopViews}
            checkedItemIds={checkedItemIds}
            selectedStopOrder={null}
            onToggleItem={toggleItem}
            onSelectStop={() => {}}
            routeId={route.id}
          />
        </div>
      )}
    </div>
  );
}
