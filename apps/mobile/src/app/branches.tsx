import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; stores: Store[] };

export default function BranchesScreen() {
  const router = useRouter();
  // Set when arriving from an existing list's "continue to route" - picking a
  // branch then plans that list's route there instead of starting a new list.
  const { listCode } = useLocalSearchParams<{ listCode?: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [routingStoreId, setRoutingStoreId] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // Bumped by the retry button to re-run the fetch.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch("/api/stores")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((stores: Store[]) => {
        if (!cancelled) setState({ status: "ready", stores });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function handleRouteAtStore(storeId: string) {
    setRoutingStoreId(storeId);
    setRouteError(null);
    try {
      const listRes = await apiFetch(`/api/lists/${listCode}`);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      const { list }: { list: ShoppingList } = await listRes.json();
      const res = await apiFetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, shoppingListId: list.id, items: list.items }),
      });
      if (!res.ok) {
        const body: { code?: string } | null = await res.json().catch(() => null);
        setRouteError(
          body?.code === "missing_entrance_or_checkout"
            ? he.review.missingEntranceOrCheckout
            : body?.code === "disconnected_graph"
              ? he.review.disconnectedGraph
              : he.common.error,
        );
        setRoutingStoreId(null);
        return;
      }
      const route: { id: string } = await res.json();
      router.push(`/route/${route.id}`);
    } catch {
      setRouteError(he.common.error);
      setRoutingStoreId(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.branches.title}</Text>
        <Text style={styles.subtitle}>{he.branches.subtitle}</Text>
      </View>

      {state.status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}

      {/* Kept distinct from "no branches" - a failed request (server down, phone
          offline) must not look like the stores were deleted. */}
      {state.status === "error" && (
        <View style={styles.center}>
          <Text style={styles.empty}>{he.branches.loadFailed}</Text>
          <Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>
            {he.branches.retry}
          </Button>
        </View>
      )}

      {routeError && <Text style={styles.errorText}>{routeError}</Text>}

      {state.status === "ready" && (
        <View style={styles.list}>
          {state.stores.length === 0 && <Text style={styles.empty}>{he.branches.noBranches}</Text>}
          {state.stores.map((store) => (
            <Card key={store.id} style={styles.storeCard}>
              <View>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeAddress}>{store.address}</Text>
              </View>
              {listCode ? (
                <Button onPress={() => handleRouteAtStore(store.id)} disabled={routingStoreId !== null}>
                  {routingStoreId === store.id ? he.common.loading : he.branches.selectBranch}
                </Button>
              ) : (
                <Link href={`/list/${store.id}`} asChild>
                  <Button>{he.branches.selectBranch}</Button>
                </Link>
              )}
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 24,
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
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  center: {
    paddingVertical: 32,
    gap: 12,
    alignItems: "center",
  },
  empty: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
    textAlign: "center",
  },
  list: {
    gap: 16,
  },
  storeCard: {
    gap: 12,
    alignItems: "flex-start",
  },
  storeName: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  storeAddress: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
