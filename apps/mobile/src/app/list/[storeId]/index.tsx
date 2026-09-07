import { Link, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

function ManualIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke={COLORS.cyan600} strokeWidth={1.75}>
      <Path d="M8 6h11M8 12h11M8 18h11" strokeLinecap="round" />
      <Path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" />
    </Svg>
  );
}

function PhotoIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke={COLORS.cyan600} strokeWidth={1.75}>
      <Path
        d="M4 8a2 2 0 0 1 2-2h1.5l1-1.5h7l1 1.5H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.5} />
    </Svg>
  );
}

export default function ChooseListMethodScreen() {
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [store, setStore] = useState<Store | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/stores/${storeId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Store | null) => {
        if (!cancelled) setStore(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (!store) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.list.chooseMethod.title}</Text>
        <Text style={styles.subtitle}>{he.list.chooseMethod.subtitle}</Text>
        <Text style={styles.storeName}>{store.name}</Text>
      </View>

      <View style={styles.grid}>
        <Link href={`/list/${storeId}/manual`} asChild>
          <Pressable style={styles.card}>
            <ManualIcon />
            <Text style={styles.cardTitle}>{he.list.chooseMethod.manualTitle}</Text>
            <Text style={styles.cardDescription}>{he.list.chooseMethod.manualDescription}</Text>
          </Pressable>
        </Link>

        <Link href={`/list/${storeId}/photo`} asChild>
          <Pressable style={styles.card}>
            <PhotoIcon />
            <Text style={styles.cardTitle}>{he.list.chooseMethod.photoTitle}</Text>
            <Text style={styles.cardDescription}>{he.list.chooseMethod.photoDescription}</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  storeName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  grid: {
    flexDirection: "row",
    gap: 16,
  },
  card: {
    flex: 1,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
    textAlign: "center",
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textAlign: "center",
  },
});
