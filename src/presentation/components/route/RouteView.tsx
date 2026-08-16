"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MapNode } from "@/src/domain/entities/map-node";
import type { Route } from "@/src/domain/entities/route";
import type { Store } from "@/src/domain/entities/store";
import { Checklist, type ChecklistStopView } from "@/src/presentation/components/checklist/Checklist";
import { StoreMap } from "@/src/presentation/components/map/StoreMap";
import { LinkButton } from "@/src/presentation/components/ui/LinkButton";
import { ProgressBar } from "@/src/presentation/components/ui/ProgressBar";
import { useAnalytics } from "@/src/presentation/hooks/useAnalytics";
import { he } from "@/src/presentation/i18n/he";

interface RouteViewProps {
  route: Route;
  store: Store;
  mapImageUrl: string;
  nodes: MapNode[];
  stopViews: ChecklistStopView[];
  previewMode?: boolean;
}

function storageKey(routeId: string): string {
  return `smartroute:route:${routeId}:checked`;
}

export function RouteView({ route, store, mapImageUrl, nodes, stopViews, previewMode = false }: RouteViewProps) {
  const { sessionId, logEvent } = useAnalytics(previewMode);
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [selectedStopOrder, setSelectedStopOrder] = useState<number | null>(
    stopViews[0]?.stop.order ?? null,
  );
  const [hydrated, setHydrated] = useState(false);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    logEvent("route_started", {}, { routeId: route.id, storeId: route.storeId });
  }, [sessionId, logEvent, route.id, route.storeId]);

  useEffect(() => {
    function handleBeforeUnload() {
      if (finishedRef.current) return;
      logEvent("route_abandoned", {}, { routeId: route.id, storeId: route.storeId });
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [logEvent, route.id, route.storeId]);

  // Checked state survives a reload/app-switch mid-shop; each route gets its own key.
  // localStorage isn't available during SSR, so this necessarily reads after
  // mount rather than via a lazy useState initializer.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(route.id));
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Only the leg to the next not-yet-fully-checked stop is drawn, so the shopper always sees
  // "how do I get to my next item" rather than the entire remaining route at once. Once every
  // stop is checked off, the leg to checkout is shown instead.
  const nextStop = useMemo(
    () => stopViews.find(({ stop }) => !checkedStopOrders.has(stop.order))?.stop,
    [stopViews, checkedStopOrders],
  );
  const displayPathNodeIds = nextStop ? nextStop.pathFromPrevious : route.checkoutPathNodeIds;

  function toggleItem(itemId: string) {
    // Compute the new checked state and log outside the updater: setState
    // updaters must stay pure (React Strict Mode double-invokes them in dev
    // specifically to catch side effects like this, which would otherwise
    // double-log the event).
    const nowChecked = !checkedItemIds.has(itemId);
    logEvent("item_checked", { itemId, checked: nowChecked }, { routeId: route.id, storeId: route.storeId });
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (nowChecked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col">
      <div className="flex shrink-0 flex-col gap-4 px-4 pb-4 pt-6">
        <header className="flex flex-col gap-2 px-1">
          <h1 className="text-xl font-bold text-neutral-900">{store.name}</h1>
          <ProgressBar value={progress} />
          <p className="text-sm text-neutral-500">{he.route.progress(checkedCount, totalItems)}</p>
        </header>

        <StoreMap
          mapWidth={store.mapWidth}
          mapHeight={store.mapHeight}
          mapImageUrl={mapImageUrl}
          nodes={nodes}
          pathNodeIds={displayPathNodeIds}
          stops={route.stops}
          checkedStopOrders={checkedStopOrders}
          selectedStopOrder={selectedStopOrder}
          onSelectStop={setSelectedStopOrder}
        />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
        <Checklist
          stopViews={stopViews}
          checkedItemIds={checkedItemIds}
          selectedStopOrder={selectedStopOrder}
          onToggleItem={toggleItem}
          onSelectStop={setSelectedStopOrder}
          routeId={route.id}
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
          onClick={() => {
            finishedRef.current = true;
          }}
        >
          {he.route.finishShopping}
        </LinkButton>
      </div>
    </div>
  );
}
