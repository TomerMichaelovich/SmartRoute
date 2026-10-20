import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { CATEGORY_ICON } from "@/lib/list-widget-shared";

interface DidYouMeanModalProps {
  /** What the shopper typed; null hides the dialog. */
  typedText: string | null;
  suggestions: Product[];
  onPick: (product: Product) => void;
  onKeepAsTyped: () => void;
  onBackToEdit: () => void;
}

/**
 * "Did you mean...?" for an item typed on the home card that didn't match a
 * product clearly (see suggestBeforeAdding): one tap picks the intended
 * product, or the item goes in exactly as typed.
 */
export function DidYouMeanModal({ typedText, suggestions, onPick, onKeepAsTyped, onBackToEdit }: DidYouMeanModalProps) {
  const t = he.myList.widget.didYouMean;
  return (
    <Modal visible={typedText !== null} transparent animationType="fade" onRequestClose={onBackToEdit}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackToEdit} accessibilityLabel={t.backToEdit} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.title}</Text>
            {typedText !== null && <Text style={styles.typed}>{t.typed(typedText)}</Text>}
          </View>

          <View style={styles.options}>
            {suggestions.map((product) => (
              <Pressable
                key={product.id}
                onPress={() => onPick(product)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                accessibilityRole="button"
              >
                <View style={styles.optionIcon}>
                  <Text style={styles.optionIconText}>{CATEGORY_ICON[product.category] ?? CATEGORY_ICON.other}</Text>
                </View>
                <Text style={styles.optionText} numberOfLines={2}>
                  {product.canonicalName}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.footer}>
            <Pressable onPress={onKeepAsTyped} hitSlop={8} accessibilityRole="button" style={styles.footerButton}>
              <Text style={styles.keepText}>{t.keepAsTyped}</Text>
            </Pressable>
            <Pressable onPress={onBackToEdit} hitSlop={8} accessibilityRole="button" style={styles.footerButton}>
              <Text style={styles.backText}>{t.backToEdit}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    gap: 16,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  typed: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  options: {
    gap: 8,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.neutral50,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionPressed: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconText: {
    fontSize: 18,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  footerButton: {
    paddingVertical: 6,
  },
  keepText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
  backText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
