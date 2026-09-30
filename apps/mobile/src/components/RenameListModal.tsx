import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface RenameListModalProps {
  visible: boolean;
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}

// Alert.prompt is iOS-only, so renaming gets its own small dialog.
export function RenameListModal({ visible, initialName, onCancel, onSave }: RenameListModalProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.dialog}>
          <Text style={styles.title}>{he.myList.manage.renamePrompt}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={he.list.namePlaceholder}
            placeholderTextColor={COLORS.neutral500}
            maxLength={60}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
            style={styles.input}
          />
          <View style={styles.actions}>
            <Button variant="secondary" onPress={onCancel} style={styles.action}>
              {he.myList.manage.cancel}
            </Button>
            <Button onPress={handleSave} disabled={saving || !name.trim()} style={styles.action}>
              {saving ? he.common.loading : he.myList.manage.save}
            </Button>
          </View>
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
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    gap: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
    textAlign: "right",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  action: {
    flex: 1,
  },
});
