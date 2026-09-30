import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { setMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

/**
 * The home screen's "create list": plan a list ahead of time without picking a
 * branch (the server files it under a default store; the real branch is chosen
 * when continuing from the list to a route). On success it returns to the home
 * screen, which then shows the new list in its widget. Account holders can keep
 * several lists, so they may also name this one.
 */
export default function NewListScreen() {
  const router = useRouter();
  const { status } = useAuth();
  const canName = status === "authenticated";
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawItems = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  async function handleSubmit() {
    if (rawItems.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawItems, ...(canName && name.trim() ? { name: name.trim() } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const shoppingList: { shareCode: string } = await res.json();
      await setMyListCode(shoppingList.shareCode);
      refreshMyListWidget();
      router.dismissTo("/");
    } catch {
      setError(he.common.error);
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.title}>{canName ? he.myList.manage.newList : he.list.title}</Text>
        <Text style={styles.subtitle}>{he.list.subtitle}</Text>
      </View>

      {canName && (
        <View style={styles.field}>
          <Text style={styles.label}>{he.list.nameLabel}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={he.list.namePlaceholder}
            placeholderTextColor={COLORS.neutral500}
            maxLength={60}
            textAlign="right"
            returnKeyType="next"
            style={styles.nameInput}
          />
        </View>
      )}

      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={he.list.placeholder}
        placeholderTextColor={COLORS.neutral500}
        multiline
        numberOfLines={10}
        textAlign="right"
        style={styles.input}
      />
      <Text style={styles.itemCount}>{he.list.itemCount(rawItems.length)}</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <Button onPress={handleSubmit} disabled={rawItems.length === 0 || isSubmitting} fullWidth>
        {isSubmitting ? he.common.loading : he.home.createList}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  field: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  nameInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
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
