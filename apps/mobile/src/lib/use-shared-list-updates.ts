import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { rankStoreCandidates } from "@smartroute/core/application/classification/rank-store-candidates";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { Route } from "@smartroute/core/domain/entities/route";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import type { SharedAdditionEntry, SharedRemovalEntry } from "@/components/SharedListUpdateModal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { saveCheckedItemIds } from "@/lib/route-storage";

// Same cadence as the list screen's shared-list sync.
const SHARED_POLL_MS = 4000;
const CONFIDENT_MATCH = 0.85;

interface PendingUpdate {
  adderName: string;
  removerName: string;
  additions: SharedAdditionEntry[];
  removals: SharedRemovalEntry[];
  list: ShoppingList;
}

/**
 * While shopping a route built from a shared list, watches the list for items other
 * participants add or remove. Each addition is matched to what this branch carries (an
 * ambiguous one, like "נס", gets the branch's options); confirming re-plans the route -
 * a new route that keeps what's been ticked and continues from where the shopper is.
 */
export function useSharedListUpdates(route: Route | null, storeId: string | null, checkedItemIds: Set<string>) {
  const router = useRouter();
  const { user } = useAuth();
  const [watched, setWatched] = useState<{ shareCode: string; storeProducts: Product[] } | null>(null);
  const [pending, setPending] = useState<PendingUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const handledIds = useRef(new Set<string>());
  const members = useRef<HouseholdMemberView[] | null>(null);
  // Item names as last seen, so a removed item can still be named.
  const itemNames = useRef(new Map<string, string>());
  const pendingRef = useRef(pending);
  const checkedRef = useRef(checkedItemIds);
  useEffect(() => {
    pendingRef.current = pending;
    checkedRef.current = checkedItemIds;
  }, [pending, checkedItemIds]);

  // Only shared lists are watched - nobody else can change a private one. Fetched with this
  // branch's storeId, so the products are what's actually on these shelves.
  useEffect(() => {
    if (!route || !storeId) return;
    let cancelled = false;
    apiFetch(`/api/shopping-lists/${route.shoppingListId}?storeId=${storeId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { shoppingList: ShoppingList; products: Product[] } | null) => {
        if (cancelled || !data?.shoppingList.householdId || !data.shoppingList.shareCode) return;
        for (const item of data.shoppingList.items) itemNames.current.set(item.id, item.rawText);
        setWatched({ shareCode: data.shoppingList.shareCode, storeProducts: data.products });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [route, storeId]);

  useEffect(() => {
    if (!route || !watched) return;
    const inRoute = new Set([...route.stops.flatMap((s) => s.itemIds), ...route.unresolvedItemIds]);
    const onStops = route.stops.flatMap((s) => s.itemIds);
    const someone = he.route.sharedUpdate.someone;

    async function participants(): Promise<HouseholdMemberView[]> {
      if (!members.current) {
        const res = await apiFetch(`/api/lists/${watched!.shareCode}/sharing`).catch(() => null);
        members.current = res?.ok ? (await res.json()).members : [];
      }
      return members.current ?? [];
    }

    async function check() {
      if (AppState.currentState !== "active" || pendingRef.current) return;
      try {
        const res = await apiFetch(`/api/lists/${watched!.shareCode}`);
        if (!res.ok) return;
        const { list }: { list: ShoppingList } = await res.json();
        const listIds = new Set(list.items.map((i) => i.id));

        // Others' additions only - an item this shopper added themselves isn't news to them.
        const added = list.items.filter(
          (i) => !inRoute.has(i.id) && !handledIds.current.has(i.id) && (!user || i.addedByUserId !== user.id),
        );
        const removedIds = onStops.filter((id) => !listIds.has(id) && !handledIds.current.has(id));
        for (const item of list.items) itemNames.current.set(item.id, item.rawText);
        if (added.length === 0 && removedIds.length === 0) return;

        const people = await participants();
        const nameOf = (userId: string | undefined) =>
          (userId && people.find((m) => m.userId === userId)?.displayName) || someone;
        const adderIds = Array.from(new Set(added.map((i) => i.addedByUserId).filter(Boolean)));
        // Removals aren't attributed on the list; with a single other participant it can only be them.
        const others = people.filter((m) => m.status === "active" && m.userId !== user?.id);

        const carried = new Map(watched!.storeProducts.map((p) => [p.id, p]));
        const additions = added.map((item): SharedAdditionEntry => {
          const matchedId = item.classification?.matchedProductId;
          const matched = matchedId ? carried.get(matchedId) : undefined;
          let options = rankStoreCandidates(item.rawText, watched!.storeProducts);
          if (matched && !options.some((o) => o.id === matched.id)) options = [matched, ...options].slice(0, 4);
          const confident = matched && (item.classification?.confidence ?? 0) >= CONFIDENT_MATCH;
          return {
            itemId: item.id,
            rawText: item.rawText,
            options,
            chosenProductId: options.length === 1 ? options[0].id : confident ? matched.id : null,
          };
        });
        const removals = removedIds.map(
          (id): SharedRemovalEntry => ({
            itemId: id,
            name: itemNames.current.get(id) ?? "",
            collected: checkedRef.current.has(id),
          }),
        );
        setPending({
          adderName: adderIds.length === 1 ? nameOf(adderIds[0]) : someone,
          removerName: others.length === 1 ? others[0].displayName : someone,
          additions,
          removals,
          list,
        });
      } catch {
        // Best-effort background sync.
      }
    }

    const interval = setInterval(() => void check(), SHARED_POLL_MS);
    return () => clearInterval(interval);
  }, [route, watched, user]);

  function choose(itemId: string, productId: string | null) {
    setPending(
      (p) =>
        p && { ...p, additions: p.additions.map((e) => (e.itemId === itemId ? { ...e, chosenProductId: productId } : e)) },
    );
  }

  function markHandled(update: PendingUpdate) {
    for (const e of [...update.additions, ...update.removals]) handledIds.current.add(e.itemId);
  }

  function later() {
    if (pending) markHandled(pending);
    setPending(null);
  }

  async function confirm() {
    if (!pending || !route || !storeId) return;
    setBusy(true);
    const chosen = new Map(pending.additions.map((e) => [e.itemId, e.chosenProductId]));
    // The picked product becomes the item's match on the shared list too (POST /api/routes
    // saves the items), so everyone sees which one was bought. Removed items are simply
    // absent from the list, so the new route drops them.
    const items = pending.list.items.map((item) => {
      const productId = chosen.get(item.id);
      if (!productId) return item;
      return {
        ...item,
        classification: { rawText: item.rawText, matchedProductId: productId, confidence: 1, source: "dictionary" as const },
      };
    });
    const listIds = new Set(items.map((i) => i.id));
    // Ticks carry over, sent in tick order so the new route continues from where the shopper
    // is now rather than from the entrance. Additions they chose not to buy stay off the route.
    const completedItemIds = [...checkedItemIds].filter((id) => listIds.has(id));
    // The stop the map is guiding to right now - the first one with anything left to collect.
    const nextStopNodeId = route.stops.find((s) => s.itemIds.some((id) => !checkedItemIds.has(id)))?.nodeId;
    const skippedItemIds = pending.additions.filter((e) => e.chosenProductId === null).map((e) => e.itemId);
    try {
      const res = await apiFetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          shoppingListId: route.shoppingListId,
          items,
          completedItemIds,
          skippedItemIds,
          nextStopNodeId,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newRoute: { id: string } = await res.json();
      await saveCheckedItemIds(newRoute.id, new Set(completedItemIds));
      markHandled(pending);
      setPending(null);
      router.replace(`/route/${newRoute.id}`);
    } catch {
      Alert.alert(he.common.error);
    } finally {
      setBusy(false);
    }
  }

  return { pending, busy, choose, later, confirm };
}
