import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; stores: Store[] };

export default function BranchesScreen() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
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
  }, []);

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

      {state.status === "error" && <Text style={styles.empty}>{he.branches.noBranches}</Text>}

      {state.status === "ready" && (
        <View style={styles.list}>
          {state.stores.length === 0 && <Text style={styles.empty}>{he.branches.noBranches}</Text>}
          {state.stores.map((store) => (
            <Card key={store.id} style={styles.storeCard}>
              <View>
                <Text style={styles.storeName}>{store.name}</Text>
                <Text style={styles.storeAddress}>{store.address}</Text>
              </View>
              <Link href={`/list/${store.id}`} asChild>
                <Button>{he.branches.selectBranch}</Button>
              </Link>
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
    alignItems: "center",
  },
  empty: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
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
