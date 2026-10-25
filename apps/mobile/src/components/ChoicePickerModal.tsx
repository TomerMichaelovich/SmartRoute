import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export interface ChoiceOption {
  key: string;
  title: string;
  meta: string | null;
}

interface ChoicePickerModalProps {
  /** null hides the dialog. */
  title: string | null;
  /** e.g. "2 מתוך 5"; null when there's a single question. */
  progress: string | null;
  options: ChoiceOption[];
  anyLabel: string;
  /** Shown while more questions follow. */
  anyForRestLabel: string | null;
  onPick: (key: string) => void;
  onAny: () => void;
  onAnyForRest: () => void;
}

/**
 * One "what did you mean by ...?" question of a series, with a "don't mind"
 * answer first and, while more follow, "the same for the rest". Shared by the
 * cheapest-basket refinement and the in-store place choice.
 */
export function ChoicePickerModal({ title, progress, options, anyLabel, anyForRestLabel, onPick, onAny, onAnyForRest }: ChoicePickerModalProps) {
  return (
    <Modal visible={title !== null} transparent animationType="fade" onRequestClose={onAny}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.header}>
            {progress && <Text style={styles.progress}>{progress}</Text>}
            {title && <Text style={styles.title}>{title}</Text>}
          </View>

          <Pressable
            onPress={onAny}
            style={({ pressed }) => [styles.option, styles.anyOption, pressed && styles.optionPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.anyText}>{anyLabel}</Text>
          </Pressable>

          <ScrollView style={styles.options} contentContainerStyle={styles.optionsContent}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => onPick(option.key)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                accessibilityRole="button"
              >
                <Text style={styles.optionLabel} numberOfLines={2}>
                  {option.title}
                </Text>
                {option.meta ? (
                  <Text style={styles.optionMeta} numberOfLines={1}>
                    {option.meta}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          {anyForRestLabel && (
            <Pressable onPress={onAnyForRest} hitSlop={8} accessibilityRole="button" style={styles.footerButton}>
              <Text style={styles.footerText}>{anyForRestLabel}</Text>
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
