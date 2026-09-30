import { Link, Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; trips: ShoppingTrip[] };

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(iso));
}

/** RN port of the web's /history page - the logged-in shopper's completed trips. */
export default function HistoryScreen() {
  const { status } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // Bumped by the retry button to re-run the fetch.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    setState({ status: "loading" });
    apiFetch("/api/trips")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(({ trips }: { trips: ShoppingTrip[] }) => {
        if (!cancelled) setState({ status: "ready", trips });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [status, attempt]);

  if (status === "guest") {
    return <Redirect href="/login" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.history.title}</Text>
        <Text style={styles.subtitle}>{he.history.subtitle}</Text>
      </View>

      {state.status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.center}>
          <Text style={styles.empty}>{he.history.loadFailed}</Text>
          <Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>
            {he.history.retry}
          </Button>
        </View>
      )}

      {state.status === "ready" && state.trips.length === 0 && <Text style={styles.empty}>{he.history.empty}</Text>}

      {state.status === "ready" && (
        <View style={styles.list}>
          {state.trips.map((trip) => {
            const collected = trip.items.filter((item) => item.collected && !item.notFound).length;
            return (
              <Link key={trip.id} href={`/history/${trip.id}`} asChild>
                <Pressable accessibilityRole="button">
                  <Card style={styles.tripCard}>
                    <Text style={styles.storeName}>{trip.storeName}</Text>
                    <Text style={styles.meta}>
                      {formatDate(trip.completedAt)} · {he.history.collectedCount(collected, trip.items.length)}
                    </Text>
                  </Card>
                </Pressable>
              </Link>
            );
          })}
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
    gap: 20,
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
  center: {
    paddingVertical: 32,
    gap: 12,
    alignItems: "center",
  },
  empty: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textAlign: "center",
  },
  list: {
    gap: 12,
  },
  tripCard: {
    gap: 4,
  },
  storeName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
