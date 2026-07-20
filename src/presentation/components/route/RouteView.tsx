"use client";

import { useEffect, useMemo, useState } from "react";
import type { MapEdge } from "@/src/domain/entities/map-edge";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { Route } from "@/src/domain/entities/route";
import type { Store } from "@/src/domain/entities/store";
import { Checklist, type ChecklistStopView } from "@/src/presentation/components/checklist/Checklist";
import { StoreMap } from "@/src/presentation/components/map/StoreMap";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { ProgressBar } from "@/src/presentation/components/ui/ProgressBar";
import { he } from "@/src/presentation/i18n/he";

interface RouteViewProps {
  route: Route;
  store: Store;
  nodes: MapNode[];
  edges: MapEdge[];
  stopViews: ChecklistStopView[];
}

function storageKey(routeId: string): string {
  return `smartroute:route:${routeId}:checked`;
}

export function RouteView({ route, store, nodes, edges, stopViews }: RouteViewProps) {
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [selectedStopOrder, setSelectedStopOrder] = useState<number | null>(
    stopViews[0]?.stop.order ?? null,
  );
  const [hydrated, setHydrated] = useState(false);

  // Checked state survives a reload/app-switch mid-shop; each route gets its own key.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(route.id));
      if (raw) setCheckedItemIds(new Set(JSON.parse(raw)));
    } catch {
      // localStorage unavailable or corrupted - fall back to empty state
    }
    setHydrated(true);
  }, [route.id]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey(route.id), JSON.stringify(Array.from(checkedItemIds)));
  }, [checkedItemIds, hydrated, route.id]);

  const totalItems = useMemo(
    () => stopViews.reduce((sum, s) => sum + s.items.length, 0),
    [stopViews],
  );
  const checkedCount = useMemo(
    () =>
      stopViews.reduce(
        (sum, s) => sum + s.items.filter((item) => checkedItemIds.has(item.id)).length,
        0,
      ),
    [stopViews, checkedItemIds],
  );
  const progress = totalItems === 0 ? 1 : checkedCount / totalItems;
  const allDone = totalItems > 0 && checkedCount === totalItems;

  const checkedStopOrders = useMemo(() => {
    const set = new Set<number>();
    for (const { stop, items } of stopViews) {
      if (items.length > 0 && items.every((item) => checkedItemIds.has(item.id))) {
        set.add(stop.order);
      }
    }
    return set;
  }, [stopViews, checkedItemIds]);

  function toggleItem(itemId: string) {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-2 px-1">
        <h1 className="text-xl font-bold text-neutral-900">{store.name}</h1>
        <ProgressBar value={progress} />
        <p className="text-sm text-neutral-500">{he.route.progress(checkedCount, totalItems)}</p>
      </header>

      <StoreMap
        mapWidth={store.mapWidth}
        mapHeight={store.mapHeight}
        nodes={nodes}
        edges={edges}
        pathNodeIds={route.pathNodeIds}
        stops={route.stops}
        checkedStopOrders={checkedStopOrders}
        selectedStopOrder={selectedStopOrder}
        onSelectStop={setSelectedStopOrder}
      />

      <Checklist
        stopViews={stopViews}
        checkedItemIds={checkedItemIds}
        selectedStopOrder={selectedStopOrder}
        onToggleItem={toggleItem}
        onSelectStop={setSelectedStopOrder}
      />

      {route.unresolvedItemIds.length > 0 && (
        <p className="text-sm text-amber-700">
          {he.route.unresolvedNotice(route.unresolvedItemIds.length)}
        </p>
      )}

      <LinkButton
        href={`/summary/${route.id}`}
        fullWidth
        variant={allDone ? "primary" : "secondary"}
      >
        {he.route.finishShopping}
      </LinkButton>
    </div>
  );
}
