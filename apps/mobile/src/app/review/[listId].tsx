import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { ClassificationReviewRow } from "@/components/ClassificationReviewRow";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; shoppingList: ShoppingList; products: Product[] };

export default function ReviewScreen() {
  const router = useRouter();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/shopping-lists/${listId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { shoppingList: ShoppingList; products: Product[] }) => {
        if (cancelled) return;
        setState({ status: "ready", shoppingList: data.shoppingList, products: data.products });
        setItems(data.shoppingList.items);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const products = state.status === "ready" ? state.products : [];

  const productsByDepartment = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const list = map.get(p.department) ?? [];
      list.push(p);
      map.set(p.department, list);
    }
    return Array.from(map.entries()).map(([department, departmentProducts]) => ({
      department,
      products: departmentProducts,
    }));
  }, [products]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function handleChangeProduct(itemId: string, productId: string | null) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!productId) {
          return { ...item, classification: { rawText: item.rawText, confidence: 0, source: "unresolved" } };
        }
        return {
          ...item,
          classification: {
            rawText: item.rawText,
            matchedProductId: productId,
            confidence: 1,
            source: item.classification?.source ?? "unresolved",
          },
        };
      }),
    );
  }

  const unresolvedCount = items.filter((item) => !item.classification?.matchedProductId).length;

  async function handleSubmit() {
    if (state.status !== "ready") return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId: state.shoppingList.storeId, shoppingListId: state.shoppingList.id, items }),
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
        setIsSubmitting(false);
        return;
      }
      const route: { id: string } = await res.json();
      router.replace(`/route/${route.id}`);
    } catch {
      setError(he.common.error);
      setIsSubmitting(false);
    }
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
        <Text style={styles.errorText}>{he.common.error}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{he.review.title}</Text>
        <Text style={styles.subtitle}>{he.review.subtitle}</Text>
      </View>

      <View style={styles.rows}>
        {items.map((item) => (
          <ClassificationReviewRow
            key={item.id}
            item={item}
            productsByDepartment={productsByDepartment}
            productById={productById}
            onChangeProduct={handleChangeProduct}
          />
        ))}
      </View>

      {unresolvedCount > 0 && <Text style={styles.unresolvedWarning}>{he.review.unresolvedWarning(unresolvedCount)}</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      <Button onPress={handleSubmit} disabled={isSubmitting} fullWidth>
        {isSubmitting ? he.common.loading : he.review.continueToRoute}
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
  rows: {
    gap: 12,
  },
  unresolvedWarning: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#b45309",
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
