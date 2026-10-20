import { ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { ShoppingListInput } from "@/components/ShoppingListInput";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export type PhotoListStage = "recognizing" | "review" | "error";

interface PhotoListModalProps {
  /** null hides the dialog. */
  stage: PhotoListStage | null;
  /** Recognized items, one per line - editable before adding. */
  text: string;
  onChangeText: (text: string) => void;
  busy: boolean;
  onAdd: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Adding items from a photo of a shopping list: waits for the text recognition, then shows
 * the recognized items for a quick fix-up before they're added to the list.
 */
export function PhotoListModal({ stage, text, onChangeText, busy, onAdd, onRetry, onClose }: PhotoListModalProps) {
  const t = he.list.photo;
  const lineCount = text.split("\n").filter((l) => l.trim()).length;
  return (
    <Modal visible={stage !== null} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <View style={styles.dialog}>
          <Text style={styles.title}>📷 {t.title}</Text>

          {stage === "recognizing" && (
            <View style={styles.center}>
              <ActivityIndicator color={COLORS.cyan600} />
              <Text style={styles.hint}>{t.recognizing}</Text>
            </View>
          )}

          {stage === "error" && (
            <>
              <Text style={styles.error}>{t.recognizeError}</Text>
              <Button onPress={onRetry} fullWidth>
                {t.retake}
              </Button>
            </>
          )}

          {stage === "review" && (
            <>
              <Text style={styles.hint}>{t.reviewHint}</Text>
              <ShoppingListInput
                value={text}
                onChangeText={onChangeText}
                textAlign="right"
                style={styles.input}
              />
              <Button onPress={onAdd} disabled={busy || lineCount === 0} fullWidth>
                {busy ? he.common.loading : t.addToList(lineCount)}
              </Button>
            </>
          )}

          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>{he.myList.manage.cancel}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "90%",
    gap: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  center: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
  },
  hint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  error: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#b91c1c",
  },
  input: {
    minHeight: 160,
    maxHeight: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 14,
    fontSize: 16,
    lineHeight: 24,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
    textAlignVertical: "top",
  },
  close: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
