import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type { MapNode } from "@smartroute/core/domain/entities/map-node";
import type { Route } from "@smartroute/core/domain/entities/route";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch, resolveAssetUrl } from "@/lib/api";
import { Button } from "@/components/Button";
import { Checklist, type ChecklistStopView } from "@/components/Checklist";
import { ProgressBar } from "@/components/ProgressBar";
import { SharedListUpdateModal } from "@/components/SharedListUpdateModal";
import { StoreMap } from "@/components/StoreMap";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { clearMyListCode, getMyListCode } from "@/lib/my-list-storage";
import { loadCheckedItemIds, saveCheckedItemIds } from "@/lib/route-storage";
import { useSharedListUpdates } from "@/lib/use-shared-list-updates";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

interface RoutePayload {
  route: Route;
  store: Store;
  nodes: MapNode[];
  mapImageUrl: string;
  stopViews: ChecklistStopView[];
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: RoutePayload };

/**
 * RN port of the web's RouteView.tsx. Not ported: analytics (route_started/route_abandoned/
 * item_checked/item_not_found events - see useAnalytics.ts) and promotions display, both
 * separate deferred phases. The checked/not-found state itself and the map's progressive
 * route reveal (only the next unchecked stop's leg is drawn) work the same as web.
 */
export default function RouteScreen() {
  const { routeId } = useLocalSearchParams<{ routeId: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [notFoundItemIds, setNotFoundItemIds] = useState<Set<string>>(new Set());
  // Which route's ticks have been loaded - saving waits for the current one, so moving to a
  // re-planned route (shared-list additions) never writes the old route's ticks over it.
  const [hydratedRouteId, setHydratedRouteId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  // Set once "finish" is tapped and never cleared: finishing a pinned list removes the bought
  // items on the server, which the shared-list watcher must not report as someone's removal.
  const [finished, setFinished] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await apiFetch(`/api/routes/${routeId}`);
        if (!res.ok) {
          if (!cancelled) setState({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data: RoutePayload = await res.json();
        if (cancelled) return;
        setState({ status: "ready", data });
        const checked = await loadCheckedItemIds(routeId);
        if (!cancelled) {
          setCheckedItemIds(checked);
          setHydratedRouteId(routeId);
        }
      } catch (err) {
        if (!cancelled) {
          setState({ status: "error", message: err instanceof Error ? err.message : "Unknown error" });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [routeId]);

  useEffect(() => {
    if (hydratedRouteId !== routeId) return;
    saveCheckedItemIds(routeId, checkedItemIds);
  }, [checkedItemIds, hydratedRouteId, routeId]);

  const stopViews = state.status === "ready" ? state.data.stopViews : [];
  const sharedUpdates = useSharedListUpdates(
    state.status === "ready" ? state.data.route : null,
    state.status === "ready" ? state.data.store.id : null,
    checkedItemIds,
    !finished,
  );

  const totalItems = useMemo(() => stopViews.reduce((sum, s) => sum + s.items.length, 0), [stopViews]);
  const checkedCount = useMemo(
    () => stopViews.reduce((sum, s) => sum + s.items.filter((item) => checkedItemIds.has(item.id)).length, 0),
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

  const nextStop = useMemo(
    () => stopViews.find(({ stop }) => !checkedStopOrders.has(stop.order))?.stop,
    [stopViews, checkedStopOrders],
  );
  const lastCheckedStop = useMemo(() => {
    const lastCheckedItemId = Array.from(checkedItemIds).at(-1);
    if (!lastCheckedItemId) return undefined;
    return stopViews.find(({ items }) => items.some((item) => item.id === lastCheckedItemId))?.stop;
  }, [stopViews, checkedItemIds]);
  const displayPathNodeIds =
    state.status === "ready"
      ? (nextStop?.pathFromPrevious ?? lastCheckedStop?.pathToCheckout ?? state.data.route.checkoutPathNodeIds)
      : [];

  function toggleItem(itemId: string) {
    setCheckedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleNotFound(itemId: string) {
    const nowNotFound = !notFoundItemIds.has(itemId);
    setNotFoundItemIds((prev) => {
      const next = new Set(prev);
      if (nowNotFound) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
    if (nowNotFound) setCheckedItemIds((prev) => new Set(prev).add(itemId));
  }

  // Records the trip in the shopper's history (server no-ops with 204 for
  // guests and lists that aren't theirs). Best-effort: a failed save still
  // lets them finish, it just doesn't claim anything was saved.
  async function handleFinish() {
    setFinished(true);
    setFinishing(true);
    let saved = false;
    try {
      // Not-found items are also in checkedItemIds (so they count as done) -
      // keep them out of "collected".
      const collectedItemIds = Array.from(checkedItemIds).filter((id) => !notFoundItemIds.has(id));
      const res = await apiFetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, collectedItemIds, notFoundItemIds: Array.from(notFoundItemIds) }),
      });
      saved = res.status === 200 || res.status === 201;
    } catch {
      // Offline or server error - finish without history.
    }
    await forgetFinishedHomeList();
    setFinishing(false);

    const goHome = { text: he.route.finishedOk, onPress: () => router.replace("/") };
    Alert.alert(
      he.route.finishedTitle,
      saved ? he.route.finishedSavedBody : he.route.finishedBody,
      saved
        ? [{ text: he.route.finishedViewHistory, onPress: () => router.replace("/history") }, goHome]
        : [goHome],
    );
  }

  // A finished list shouldn't stay on the home screen / Android widget. The
  // server already deactivates a logged-in owner's list in /api/trips; this
  // drops the locally-held code (the guest's home list, and the widget's
  // source for everyone) - but only if it's the list just shopped with.
  async function forgetFinishedHomeList() {
    if (state.status !== "ready") return;
    const code = await getMyListCode();
    if (!code) return;
    try {
      const res = await apiFetch(`/api/lists/${code}`);
      if (!res.ok) return;
      const { list }: { list: { id: string; isPinned?: boolean } } = await res.json();
      // A pinned list stays on the home screen (the server only clears what was bought).
      if (list.id !== state.data.route.shoppingListId || list.isPinned) return;
      await clearMyListCode();
      refreshMyListWidget();
    } catch {
      // Best-effort - worst case the list stays on the home screen.
    }
  }

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load route {routeId}: {state.message}</Text>
      </View>
    );
  }

  const { route, store, nodes, mapImageUrl } = state.data;

  // Full-screen map: just the store name, progress and the map - the expand
  // button on the map brings the list back.
  return (
    <View style={styles.screen}>
      <View style={[styles.top, mapExpanded && styles.topExpanded]}>
        <Text style={styles.title}>{store.name}</Text>
        <ProgressBar value={progress} />
        <Text style={styles.progressText}>{he.route.progress(checkedCount, totalItems)}</Text>

        <StoreMap
          mapWidth={store.mapWidth}
          mapHeight={store.mapHeight}
          mapImageUrl={mapImageUrl ? resolveAssetUrl(mapImageUrl) : undefined}
          nodes={nodes}
          pathNodeIds={displayPathNodeIds}
          stops={route.stops}
          checkedStopOrders={checkedStopOrders}
          expanded={mapExpanded}
          onToggleExpanded={() => setMapExpanded((v) => !v)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.bottom} style={mapExpanded && styles.hidden}>
        <Checklist
          stopViews={stopViews}
          checkedItemIds={checkedItemIds}
          notFoundItemIds={notFoundItemIds}
          onToggleItem={toggleItem}
          onNotFoundItem={toggleNotFound}
        />

        {route.unresolvedItemIds.length > 0 && (
          <Text style={styles.unresolvedNotice}>{he.route.unresolvedNotice(route.unresolvedItemIds.length)}</Text>
        )}

        <Button variant={allDone ? "primary" : "secondary"} fullWidth onPress={handleFinish} disabled={finishing}>
          {finishing ? he.common.loading : he.route.finishShopping}
        </Button>
      </ScrollView>

      <SharedListUpdateModal
        visible={sharedUpdates.pending !== null}
        adderName={sharedUpdates.pending?.adderName ?? ""}
        removerName={sharedUpdates.pending?.removerName ?? ""}
        additions={sharedUpdates.pending?.additions ?? []}
        removals={sharedUpdates.pending?.removals ?? []}
        busy={sharedUpdates.busy}
        onChoose={sharedUpdates.choose}
        onConfirm={sharedUpdates.confirm}
        onLater={sharedUpdates.later}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  screen: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  top: {
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
  },
  topExpanded: {
    flex: 1,
  },
  hidden: {
    display: "none",
  },
  title: {
    fontSize: 20,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  progressText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  bottom: {
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  unresolvedNotice: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#b45309",
  },
});
