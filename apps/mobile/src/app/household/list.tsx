import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

const POLL_MS = 4000;

type LoadState = { status: "loading" } | { status: "none" } | { status: "ready"; store: Store | null };

// RN port of the web's SharedListEditor.tsx / /household/list page.
export default function HouseholdListScreen() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [code, setCode] = useState("");
  const [listId, setListId] = useState("");
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = useRef(0);
  const codeRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await apiFetch("/api/household");
      if (cancelled) return;
      if (!res.ok) {
        setState({ status: "none" });
        return;
      }
      const data: { sharedList?: ShoppingList | null } = await res.json();
      if (!data.sharedList) {
        setState({ status: "none" });
        return;
      }
      const list = data.sharedList;
      setCode(list.shareCode ?? "");
      codeRef.current = list.shareCode ?? "";
      setListId(list.id);
      setItems(list.items);

      const [storeRes, productsRes] = await Promise.all([
        apiFetch(`/api/stores/${list.storeId}`),
        apiFetch(`/api/shopping-lists/${list.id}`),
      ]);
      const store: Store | null = storeRes.ok ? await storeRes.json() : null;
      if (productsRes.ok) {
        const productsData: { products: Product[] } = await productsRes.json();
        const map: Record<string, string> = {};
        for (const p of productsData.products) map[p.id] = p.canonicalName;
        if (!cancelled) setProductNameById(map);
      }
      if (!cancelled) setState({ status: "ready", store });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (pending.current > 0 || !codeRef.current) return;
    try {
      const res = await apiFetch(`/api/lists/${codeRef.current}`);
      if (!res.ok) return;
      const data: { list: ShoppingList } = await res.json();
      if (pending.current === 0) setItems(data.list.items);
    } catch {
      // best-effort background sync
    }
  }, []);

  useEffect(() => {
    if (state.status !== "ready") return;
    const interval = setInterval(refetch, POLL_MS);
    return () => clearInterval(interval);
  }, [state.status, refetch]);

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
      apiFetch(`/api/lists/${code}/items`, {
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
      apiFetch(`/api/lists/${code}/items/${itemId}`, {
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
    void mutate(() => apiFetch(`/api/lists/${code}/items/${itemId}`, { method: "DELETE" }));
  }

  async function handleGenerateRoute() {
    if (state.status !== "ready") return;
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: state.store?.id, shoppingListId: listId, items }),
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

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (state.status === "none") {
    return <Redirect href="/household" />;
  }

  const collected = items.filter((it) => it.checked).length;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.household.sharedList.heading}</Text>
        <Text style={styles.subtitle}>{he.household.sharedList.subtitle}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{state.store?.name}</Text>
        <Text style={styles.metaText}>
          {items.length > 0 ? he.household.sharedList.collected(collected, items.length) : ""}
          {syncing ? ` · ${he.household.sharedList.syncing}` : ""}
        </Text>
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>{he.household.sharedList.empty}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const name =
              (item.classification?.matchedProductId && productNameById[item.classification.matchedProductId]) ||
              item.rawText;
            return (
              <View key={item.id} style={styles.row}>
                <Button
                  variant={item.checked ? "primary" : "secondary"}
                  onPress={() => toggleChecked(item)}
                  style={styles.checkButton}
                >
                  {item.checked ? "✓" : " "}
                </Button>
                <View style={styles.rowInfo}>
                  <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>{name}</Text>
                  {item.checked && item.checkedByName && (
                    <Text style={styles.collectedBy}>{he.household.sharedList.collectedBy(item.checkedByName)}</Text>
                  )}
                </View>
                <View style={styles.qtyRow}>
                  <Button variant="secondary" onPress={() => changeQty(item, -1)} style={styles.qtyButton}>
                    −
                  </Button>
                  <Text style={styles.qtyText}>{item.quantity ?? 1}</Text>
                  <Button variant="secondary" onPress={() => changeQty(item, 1)} style={styles.qtyButton}>
                    +
                  </Button>
                </View>
                <Button variant="secondary" onPress={() => remove(item.id)} style={styles.removeButton}>
                  {he.household.sharedList.remove}
                </Button>
              </View>
            );
          })}
        </View>
      )}

      <TextInput
        value={newText}
        onChangeText={setNewText}
        placeholder={he.household.sharedList.addPlaceholder}
        placeholderTextColor={COLORS.neutral500}
        multiline
        numberOfLines={2}
        style={styles.textarea}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button onPress={handleAdd} disabled={adding || !newText.trim()} fullWidth>
        {adding ? he.common.loading : he.household.sharedList.addButton}
      </Button>
      <Button variant="secondary" onPress={handleGenerateRoute} disabled={generating || items.length === 0} fullWidth>
        {generating ? he.common.loading : he.review.continueToRoute}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  metaText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  empty: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    padding: 8,
  },
  checkButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  itemNameChecked: {
    color: COLORS.neutral300,
    textDecorationLine: "line-through",
  },
  collectedBy: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.neutral300,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qtyButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qtyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
    minWidth: 16,
    textAlign: "center",
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textarea: {
    width: "100%",
    minHeight: 60,
    textAlignVertical: "top",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 12,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
