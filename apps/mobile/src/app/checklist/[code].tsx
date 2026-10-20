import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

  // The list itself stays (no route, so no trip to record) - only this
  // shopping run's ticks are cleared, ready for next time.
  async function handleFinish() {
    await saveCheckedItemIds(checkedKey(code), new Set());
    Alert.alert(he.route.finishedTitle, he.route.finishedBody, [
      { text: he.route.finishedOk, onPress: () => router.dismissTo("/") },
    ]);
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
        <Button variant={allDone ? "primary" : "secondary"} fullWidth onPress={handleFinish}>
          {he.route.finishShopping}
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
