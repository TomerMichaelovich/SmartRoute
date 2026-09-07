import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { ProductPickerModal } from "./ProductPickerModal";

interface ProductGroup {
  department: string;
  products: Product[];
}

interface ClassificationReviewRowProps {
  item: ShoppingListItem;
  productsByDepartment: ProductGroup[];
  productById: Map<string, Product>;
  onChangeProduct: (itemId: string, productId: string | null) => void;
}

function confidenceBadge(item: ShoppingListItem): { label: string; color: string; background: string } | null {
  const c = item.classification;
  if (!c || !c.matchedProductId || c.source === "unresolved") {
    return { label: he.review.notFound, color: "#b91c1c", background: "#fef2f2" };
  }
  if (c.availableAtStore === false) {
    return { label: he.review.outOfStock, color: "#b91c1c", background: "#fef2f2" };
  }
  if (c.confidence < 0.85) {
    return { label: he.review.checkThis, color: "#b45309", background: "#fffbeb" };
  }
  return null;
}

// RN port of the web's ClassificationReviewRow.tsx. The "did you mean X?" suggestion
// chips below are what actually surfaces the fuzzy-match layer's alternativeMatches
// (packages/core/application/classification/layers/fuzzy-match-layer.ts) to the shopper -
// e.g. typing "ביר" suggests "בירה" here, exactly like on web.
export function ClassificationReviewRow({ item, productsByDepartment, productById, onChangeProduct }: ClassificationReviewRowProps) {
  const badge = confidenceBadge(item);
  const selectedProductId = item.classification?.matchedProductId ?? "";
  const suggestions = (item.classification?.alternativeMatches ?? [])
    .filter((alt) => productById.has(alt.productId))
    .slice(0, 3);
  const [showFullList, setShowFullList] = useState(suggestions.length === 0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedProductName = selectedProductId ? productById.get(selectedProductId)?.canonicalName : undefined;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.rawText}>{item.rawText}</Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.background }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
          </View>
        )}
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <Text style={styles.suggestionsLabel}>{he.review.suggestionsLabel}</Text>
          <View style={styles.chipRow}>
            {suggestions.map((alt) => {
              const product = productById.get(alt.productId)!;
              const isSelected = selectedProductId === alt.productId;
              return (
                <Pressable
                  key={alt.productId}
                  onPress={() => onChangeProduct(item.id, alt.productId)}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{product.canonicalName}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {suggestions.length > 0 && !showFullList ? (
        <Pressable onPress={() => setShowFullList(true)}>
          <Text style={styles.showFullListLink}>{he.review.showFullList}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.picker} onPress={() => setPickerOpen(true)}>
          <Text style={styles.pickerText}>{selectedProductName ?? he.review.noMatch}</Text>
        </Pressable>
      )}

      <ProductPickerModal
        visible={pickerOpen}
        productsByDepartment={productsByDepartment}
        selectedProductId={selectedProductId}
        onSelect={(productId) => onChangeProduct(item.id, productId)}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rawText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  suggestions: {
    gap: 6,
  },
  suggestionsLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.neutral50,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  chipTextSelected: {
    color: COLORS.cyan700,
  },
  showFullListLink: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textDecorationLine: "underline",
  },
  picker: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.neutral50,
    padding: 10,
  },
  pickerText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
});
