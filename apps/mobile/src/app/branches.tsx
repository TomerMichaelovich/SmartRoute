import { Link, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { startRouteAtStore } from "@/lib/start-route";
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

  // The branch buttons stay locked while a route is being built; coming back to this
  // screen (e.g. "back" from the route) has to unlock them again.
  useFocusEffect(
    useCallback(() => {
      setRoutingStoreId(null);
    }, []),
  );

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
    if (!listCode) return;
    setRoutingStoreId(storeId);
    setRouteError(null);
    const result = await startRouteAtStore(listCode, storeId);
    if ("error" in result) {
      setRouteError(result.error);
      setRoutingStoreId(null);
      return;
    }
    router.push(`/route/${result.routeId}`);
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} persistentScrollbar>
      <View style={styles.header}>
        <Text style={styles.title}>{he.branches.title}</Text>
        <Text style={styles.subtitle}>{he.branches.subtitle}</Text>
      </View>

      {/* With a list in hand, shopping without a map/route is always an
          option - and it doesn't depend on the branches loading. */}
      {listCode && (
        <View style={styles.modes}>
          <Pressable
            onPress={() => router.push(`/checklist/${listCode}`)}
            style={({ pressed }) => [styles.listModeRow, pressed && styles.listModeRowPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.listModeIcon}>📝</Text>
            <Text style={styles.listModeText}>{he.branches.useAsList}</Text>
            <Text style={styles.listModeChevron}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/cheapest/${listCode}`)}
            style={({ pressed }) => [styles.listModeRow, styles.cheapestRow, pressed && styles.listModeRowPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.listModeIcon}>🏷️</Text>
            <View style={styles.cheapestTexts}>
              <Text style={styles.listModeText}>{he.cheapest.entry}</Text>
              <Text style={styles.cheapestSubtitle}>{he.cheapest.entrySubtitle}</Text>
            </View>
            <Text style={styles.listModeChevron}>‹</Text>
          </Pressable>
        </View>
      )}

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
  scroll: {
    flex: 1,
  },
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
  listModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  listModeRowPressed: {
    backgroundColor: COLORS.neutral100,
  },
  modes: {
    gap: 10,
  },
  cheapestRow: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  cheapestTexts: {
    flex: 1,
    gap: 2,
  },
  cheapestSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  listModeIcon: {
    fontSize: 16,
  },
  listModeText: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.neutral700,
  },
  listModeChevron: {
    fontSize: 20,
    color: COLORS.neutral500,
  },
});
