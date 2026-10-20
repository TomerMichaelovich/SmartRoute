import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, AppState } from "react-native";
import { rankStoreCandidates } from "@smartroute/core/application/classification/rank-store-candidates";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { Route } from "@smartroute/core/domain/entities/route";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import type { SharedAdditionEntry } from "@/components/SharedListUpdateModal";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { saveCheckedItemIds } from "@/lib/route-storage";

// Same cadence as the list screen's shared-list sync.
const SHARED_POLL_MS = 4000;
const CONFIDENT_MATCH = 0.85;

interface PendingAdditions {
  adderName: string;
  entries: SharedAdditionEntry[];
  list: ShoppingList;
}

/**
 * While shopping a route built from a shared list, watches the list for items other
 * participants add. Each addition is matched to what this branch carries (an ambiguous one,
 * like "נס", gets the branch's options), and confirming re-plans the route with them -
 * a new route, carrying over what's already been ticked.
 */
export function useSharedListAdditions(route: Route | null, storeId: string | null, checkedItemIds: Set<string>) {
  const router = useRouter();
  const { user } = useAuth();
  const [watched, setWatched] = useState<{ shareCode: string; storeProducts: Product[] } | null>(null);
  const [pending, setPending] = useState<PendingAdditions | null>(null);
  const [busy, setBusy] = useState(false);
  const handledIds = useRef(new Set<string>());
  const memberNames = useRef<Map<string, string> | null>(null);
  const pendingRef = useRef(pending);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  // Only shared lists are watched - nobody else can change a private one. Fetched with this
  // branch's storeId, so the products are what's actually on these shelves.
  useEffect(() => {
    if (!route || !storeId) return;
    let cancelled = false;
    apiFetch(`/api/shopping-lists/${route.shoppingListId}?storeId=${storeId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { shoppingList: ShoppingList; products: Product[] } | null) => {
        if (cancelled || !data?.shoppingList.householdId || !data.shoppingList.shareCode) return;
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

    async function adderNameFor(userIds: string[]): Promise<string> {
      if (userIds.length !== 1) return he.route.sharedUpdate.someone;
      if (!memberNames.current) {
        const res = await apiFetch(`/api/lists/${watched!.shareCode}/sharing`).catch(() => null);
        const members: HouseholdMemberView[] = res?.ok ? (await res.json()).members : [];
        memberNames.current = new Map(members.map((m) => [m.userId, m.displayName]));
      }
      return memberNames.current.get(userIds[0]) ?? he.route.sharedUpdate.someone;
    }

    async function check() {
      if (AppState.currentState !== "active" || pendingRef.current) return;
      try {
        const res = await apiFetch(`/api/lists/${watched!.shareCode}`);
        if (!res.ok) return;
        const { list }: { list: ShoppingList } = await res.json();
        // Others' additions only - an item this shopper added themselves isn't news to them.
        const added = list.items.filter(
          (i) => !inRoute.has(i.id) && !handledIds.current.has(i.id) && (!user || i.addedByUserId !== user.id),
        );
        if (added.length === 0) return;

        const carried = new Map(watched!.storeProducts.map((p) => [p.id, p]));
        const entries = added.map((item): SharedAdditionEntry => {
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
        const adderIds = Array.from(new Set(added.map((i) => i.addedByUserId).filter((id): id is string => Boolean(id))));
        setPending({ adderName: await adderNameFor(adderIds), entries, list });
      } catch {
        // Best-effort background sync.
      }
    }

    const interval = setInterval(() => void check(), SHARED_POLL_MS);
    return () => clearInterval(interval);
  }, [route, watched, user]);

  function choose(itemId: string, productId: string | null) {
    setPending((p) =>
      p && { ...p, entries: p.entries.map((e) => (e.itemId === itemId ? { ...e, chosenProductId: productId } : e)) },
    );
  }

  function later() {
    pending?.entries.forEach((e) => handledIds.current.add(e.itemId));
    setPending(null);
  }

  async function confirm() {
    if (!pending || !route || !storeId) return;
    setBusy(true);
    const chosen = new Map(pending.entries.map((e) => [e.itemId, e.chosenProductId]));
    // The picked product becomes the item's match on the shared list too (POST /api/routes
    // saves the items), so everyone sees which one was bought.
    const items = pending.list.items.map((item) => {
      const productId = chosen.get(item.id);
      if (!productId) return item;
      return {
        ...item,
        classification: { rawText: item.rawText, matchedProductId: productId, confidence: 1, source: "dictionary" as const },
      };
    });
    // Ticks carry over, sent in tick order so the new route continues from where the shopper
    // is now rather than from the entrance. Additions they chose not to buy stay off the route.
    const completedItemIds = [...checkedItemIds];
    const skippedItemIds = pending.entries.filter((e) => e.chosenProductId === null).map((e) => e.itemId);
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
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const newRoute: { id: string } = await res.json();
      await saveCheckedItemIds(newRoute.id, new Set(completedItemIds));
      pending.entries.forEach((e) => handledIds.current.add(e.itemId));
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
