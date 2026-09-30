import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ShoppingTrip } from "@smartroute/core/domain/entities/shopping-trip";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "notMine" }
  | { status: "ready"; trip: ShoppingTrip };

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
}

/** RN port of the web's /history/[tripId] page - one trip's frozen item snapshot. */
export default function TripDetailScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const router = useRouter();
  const { status } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [repeating, setRepeating] = useState(false);
  const [repeatError, setRepeatError] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    apiFetch(`/api/trips/${tripId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 403) {
          setState({ status: "notMine" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { trip }: { trip: ShoppingTrip } = await res.json();
        if (!cancelled) setState({ status: "ready", trip });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [status, tripId]);

  async function handleRepeat() {
    setRepeating(true);
    setRepeatError(false);
    try {
      const res = await apiFetch(`/api/trips/${tripId}/repeat`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { shareCode }: { shareCode: string } = await res.json();
      router.replace(`/my-list/${shareCode}`);
    } catch {
      setRepeatError(true);
      setRepeating(false);
    }
  }

  if (status === "guest") {
    return <Redirect href="/login" />;
  }

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status !== "ready") {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{state.status === "notMine" ? he.history.notMine : he.common.error}</Text>
      </View>
    );
  }

  const { trip } = state;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.history.detailTitle}</Text>
        <Text style={styles.subtitle}>
          {trip.storeName} · {formatDateTime(trip.completedAt)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionHeading}>{he.history.itemsHeading}</Text>
        <Card style={styles.itemsCard}>
          {trip.items.map((item, i) => (
            <View key={i} style={[styles.itemRow, i > 0 && styles.itemDivider]}>
              <Text style={styles.itemName}>
                {item.productName || item.rawText}
                {item.quantity ? ` ×${item.quantity}` : ""}
              </Text>
              <Text
                style={[
                  styles.itemStatus,
                  item.notFound ? styles.notFound : item.collected ? styles.collected : styles.notCollected,
                ]}
              >
                {item.notFound ? he.history.notFound : item.collected ? he.history.collected : he.history.notCollected}
              </Text>
            </View>
          ))}
        </Card>
      </View>

      {repeatError && <Text style={styles.errorText}>{he.common.error}</Text>}
      <Button onPress={handleRepeat} disabled={repeating || trip.items.length === 0} fullWidth>
        {repeating ? he.history.repeatCreating : he.history.repeat}
      </Button>
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
  message: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
    textAlign: "center",
  },
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
  section: {
    gap: 8,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  itemsCard: {
    paddingVertical: 0,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
  },
  itemDivider: {
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  itemStatus: {
    fontSize: 12,
    fontFamily: FONTS.regular,
  },
  collected: {
    color: COLORS.cyan700,
  },
  notFound: {
    color: "#b45309",
  },
  notCollected: {
    color: COLORS.neutral500,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
    textAlign: "center",
  },
});
