import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { setMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

export default function ManualShoppingListScreen() {
  const router = useRouter();
  const { storeId } = useLocalSearchParams<{ storeId: string }>();
  const [store, setStore] = useState<Store | null>(null);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const rawItems = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function handleSubmit() {
    if (rawItems.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const classifyRes = await apiFetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, rawItems }),
      });
      if (!classifyRes.ok) throw new Error("classify failed");
      const shoppingList: { id: string; shareCode: string } = await classifyRes.json();
      await setMyListCode(shoppingList.shareCode);
      refreshMyListWidget();
      router.replace(`/review/${shoppingList.id}`);
    } catch {
      setError(he.common.error);
      setIsSubmitting(false);
    }
  }

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
        <Text style={styles.title}>{he.list.title}</Text>
        <Text style={styles.subtitle}>{he.list.subtitle}</Text>
        <Text style={styles.storeName}>{store.name}</Text>
      </View>

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={he.list.placeholder}
        multiline
        numberOfLines={10}
        textAlign="right"
        style={styles.input}
      />
      <Text style={styles.itemCount}>{he.list.itemCount(rawItems.length)}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button onPress={handleSubmit} disabled={rawItems.length === 0 || isSubmitting} fullWidth>
        {isSubmitting ? he.common.loading : he.list.continueToReview}
      </Button>
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
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  storeName: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  input: {
    minHeight: 220,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
    textAlignVertical: "top",
  },
  itemCount: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  error: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
