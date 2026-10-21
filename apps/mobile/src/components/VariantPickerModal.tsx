import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export interface VariantOption {
  itemKey: string;
  name: string;
  label: string | null;
  manufacturer: string | null;
  isTypical: boolean;
  branchCount: number;
}

export interface VariantQuestion {
  itemId: string;
  rawText: string;
  productId: string;
  options: VariantOption[];
}

interface VariantPickerModalProps {
  /** The item being asked about; null hides the dialog. */
  question: VariantQuestion | null;
  index: number;
  total: number;
  onPick: (option: VariantOption) => void;
  onAny: () => void;
  onAnyForRest: () => void;
}

/**
 * "What did you mean by 'חלב'?" — one list item at a time, before comparing
 * basket prices. Every answer is saved on the list item, so it's asked once.
 */
export function VariantPickerModal({ question, index, total, onPick, onAny, onAnyForRest }: VariantPickerModalProps) {
  const t = he.cheapest.variant;
  return (
    <Modal visible={question !== null} transparent animationType="fade" onRequestClose={onAny}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            {total > 1 && <Text style={styles.progress}>{t.progress(index + 1, total)}</Text>}
            {question && <Text style={styles.title}>{t.title(question.rawText)}</Text>}
          </View>

          <Pressable
            onPress={onAny}
            style={({ pressed }) => [styles.option, styles.anyOption, pressed && styles.optionPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.anyText}>{t.any}</Text>
          </Pressable>

          <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent}>
            {question?.options.map((option) => (
              <Pressable
                key={option.itemKey}
                onPress={() => onPick(option)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.optionLabel} numberOfLines={2}>
                  {option.label || option.name}
                </Text>
                <Text style={styles.optionMeta} numberOfLines={1}>
                  {option.label ? `${option.name} · ` : ""}
                  {t.branchCount(option.branchCount)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {total - index > 1 && (
            <Pressable onPress={onAnyForRest} hitSlop={8} accessibilityRole="button" style={styles.footerButton}>
              <Text style={styles.footerText}>{t.anyForRest}</Text>
            </Pressable>
          )}
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
    maxWidth: 380,
    maxHeight: "85%",
    gap: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    gap: 2,
  },
  progress: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.neutral500,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  options: {
    flexGrow: 0,
  },
  optionsContent: {
    gap: 8,
  },
  option: {
    gap: 2,
    minHeight: 52,
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.neutral50,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionPressed: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  anyOption: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  anyText: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
  optionLabel: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  optionMeta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  footerButton: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  footerText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral600,
  },
});
