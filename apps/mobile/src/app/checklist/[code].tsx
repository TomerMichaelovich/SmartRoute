import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { resolveBeforeBranch } from "@smartroute/core/application/classification/resolve-before-branch";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { ChecklistItem } from "@/components/ChecklistItem";
import { ProgressBar } from "@/components/ProgressBar";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { loadCheckedItemIds, saveCheckedItemIds } from "@/lib/route-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

interface ChecklistRow {
  id: string;
  displayName: string;
  imageUrl?: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; list: ShoppingList; products: Product[] };

// Ticks live on the device, like the route screen's (same storage, own key).
function checkedKey(code: string): string {
  return `list-${code}`;
}

/**
 * "Use as a list" from the branch picker: the list as a plain checklist, for
 * shopping without a store map or route - grouped by department so related
 * items sit together, with the same tick / "didn't find it" rows as the route.
 */
export default function ListChecklistScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [checkedItemIds, setCheckedItemIds] = useState<Set<string>>(new Set());
  const [notFoundItemIds, setNotFoundItemIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const [finishing, setFinishing] = useState(false);
  // Set once this run is in the history, so retrying a failed finish doesn't record it twice.
  const tripSaved = useRef<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const listRes = await apiFetch(`/api/lists/${code}`);
        if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
        const { list }: { list: ShoppingList } = await listRes.json();
        const productsRes = await apiFetch(`/api/shopping-lists/${list.id}?scope=catalog`).catch(() => null);
        const products: Product[] = productsRes?.ok ? (await productsRes.json()).products : [];
        const checked = await loadCheckedItemIds(checkedKey(code));
        if (cancelled) return;
        setState({ status: "ready", list, products });
        setCheckedItemIds(checked);
        setHydrated(true);
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (hydrated) saveCheckedItemIds(checkedKey(code), checkedItemIds);
  }, [checkedItemIds, hydrated, code]);

  const groups = useMemo(() => {
    if (state.status !== "ready") return [];
    const productById = new Map(state.products.map((p) => [p.id, p]));
    const byDepartment = new Map<string, ChecklistRow[]>();
    for (const item of state.list.items) {
      const matchedId = item.classification
        ? resolveBeforeBranch(item.classification, state.products).matchedProductId
        : undefined;
      const product = matchedId ? productById.get(matchedId) : undefined;
      const department = product?.department || he.listMode.otherDepartment;
      const rows = byDepartment.get(department) ?? [];
      rows.push({ id: item.id, displayName: product?.canonicalName ?? item.rawText, imageUrl: product?.imageUrl });
      byDepartment.set(department, rows);
    }
    // Alphabetical, with the catch-all group last.
    return Array.from(byDepartment.entries()).sort(([a], [b]) => {
      if (a === he.listMode.otherDepartment) return 1;
      if (b === he.listMode.otherDepartment) return -1;
      return a.localeCompare(b, "he");
    });
  }, [state]);

  const totalItems = state.status === "ready" ? state.list.items.length : 0;
  const checkedCount = state.status === "ready" ? state.list.items.filter((i) => checkedItemIds.has(i.id)).length : 0;
  const allDone = totalItems > 0 && checkedCount === totalItems;

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

  // Records the trip in the shopper's history (as a route's finish does), then takes
  // what was bought off the list, like finishing a pinned list's route. Unticked and
  // not-found items stay.
  async function handleFinish() {
    setFinishing(true);
    const boughtIds = new Set(Array.from(checkedItemIds).filter((id) => !notFoundItemIds.has(id)));
    // Before the removal, so the trip's snapshot still has the bought items.
    if (tripSaved.current === null) tripSaved.current = await recordTrip(boughtIds);
    try {
      if (boughtIds.size > 0) await removeBoughtItems(boughtIds);
    } catch {
      setFinishing(false);
      Alert.alert(he.common.error);
      return;
    }
    await saveCheckedItemIds(checkedKey(code), new Set());
    refreshMyListWidget();
    const goHome = { text: he.route.finishedOk, onPress: () => router.dismissTo("/") };
    Alert.alert(
      he.route.finishedTitle,
      tripSaved.current ? he.route.finishedSavedBody : he.route.finishedBody,
      tripSaved.current
        ? [{ text: he.route.finishedViewHistory, onPress: () => router.replace("/history") }, goHome]
        : [goHome],
    );
  }

  // Best-effort, like the route's: the server no-ops with 204 for guests and lists
  // that aren't theirs, and a failed save still lets them finish.
  async function recordTrip(boughtIds: Set<string>): Promise<boolean> {
    try {
      const res = await apiFetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listCode: code,
          collectedItemIds: Array.from(boughtIds),
          notFoundItemIds: Array.from(notFoundItemIds),
        }),
      });
      return res.status === 201;
    } catch {
      return false;
    }
  }

  // Saves the list minus the bought items. Starts from the server's copy, so items
  // someone added mid-shop are kept; if it changed again before the save (409), the
  // removal is reapplied to the newer copy once.
  async function removeBoughtItems(boughtIds: Set<string>) {
    const res = await apiFetch(`/api/lists/${code}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let { list }: { list: ShoppingList } = await res.json();
    for (let attempt = 0; attempt < 2; attempt++) {
      const saveRes = await apiFetch(`/api/lists/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: list.items.filter((item) => !boughtIds.has(item.id)),
          expectedUpdatedAt: list.updatedAt,
        }),
      });
      if (saveRes.ok) return;
      if (saveRes.status !== 409) throw new Error(`HTTP ${saveRes.status}`);
      list = ((await saveRes.json()) as { current: ShoppingList }).current;
    }
    throw new Error("list kept changing");
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
        <Text style={styles.hint}>{he.common.error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{state.list.name ?? he.myList.defaultName()}</Text>
        <ProgressBar value={totalItems === 0 ? 1 : checkedCount / totalItems} />
        <Text style={styles.hint}>{he.route.progress(checkedCount, totalItems)}</Text>
      </View>

      {totalItems === 0 && <Text style={styles.hint}>{he.listMode.empty}</Text>}

      {groups.map(([department, rows]) => (
        <View key={department} style={styles.group}>
          <Text style={styles.department}>{department}</Text>
          <View style={styles.card}>
            {rows.map((row) => (
              <ChecklistItem
                key={row.id}
                id={row.id}
                displayName={row.displayName}
                imageUrl={row.imageUrl}
                checked={checkedItemIds.has(row.id)}
                notFound={notFoundItemIds.has(row.id)}
                onToggle={toggleItem}
                onNotFound={toggleNotFound}
              />
            ))}
          </View>
        </View>
      ))}

      {totalItems > 0 && (
        <Button variant={allDone ? "primary" : "secondary"} fullWidth onPress={handleFinish} disabled={finishing}>
          {finishing ? he.common.loading : he.route.finishShopping}
        </Button>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  hint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  group: {
    gap: 6,
  },
  department: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral500,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
});
