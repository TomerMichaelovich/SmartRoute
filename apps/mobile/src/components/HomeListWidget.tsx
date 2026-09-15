import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { clearMyListCode, getMyListCode } from "@/lib/my-list-storage";

export function HomeListWidget() {
  const router = useRouter();
  const [myList, setMyList] = useState<{ list: ShoppingList; store: Store | null } | null>(null);
  const [checked, setChecked] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    async function loadMyList() {
      const code = await getMyListCode();
      if (code) {
        try {
          const res = await apiFetch(`/api/lists/${code}`);
          if (res.ok) {
            const data: { list: ShoppingList; store: Store | null } = await res.json();
            setMyList(data);
          } else {
            await clearMyListCode();
          }
        } catch {
          // Best-effort - the widget just won't show if this fails.
        }
      }
      setChecked(true);
    }
    loadMyList();
  }, []);

  function handleOpenByCode() {
    const normalized = normalizeShareCode(codeInput);
    if (!normalized) return;
    router.push(`/my-list/${normalized}`);
  }

  // Avoid a layout flash while the AsyncStorage/fetch check is in flight.
  if (!checked) return null;

  if (myList) {
    return (
      <Link href={`/my-list/${myList.list.shareCode}`} asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>{he.myList.widgetTitle}</Text>
          {myList.store && <Text style={styles.cardStore}>{myList.store.name}</Text>}
          <Text style={styles.cardCount}>{he.myList.itemCount(myList.list.items.length)}</Text>
        </Pressable>
      </Link>
    );
  }

  return (
    <View style={styles.container}>
      {!showCodeInput ? (
        <Pressable onPress={() => setShowCodeInput(true)}>
          <Text style={styles.haveCodeLink}>{he.myList.haveCode}</Text>
        </Pressable>
      ) : (
        <View style={styles.codeRow}>
          <TextInput
            value={codeInput}
            onChangeText={setCodeInput}
            placeholder={he.myList.codePlaceholder}
            style={styles.codeInput}
            autoCapitalize="none"
          />
          <Button onPress={handleOpenByCode} disabled={!codeInput.trim()}>
            {he.myList.openByCode}
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 8,
  },
  // Mirrors the web widget's <Link class="flex w-full max-w-xs flex-col gap-1
  // rounded-2xl bg-white p-4 text-right shadow-sm">.
  card: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "column",
    gap: 4,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    alignItems: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  cardStore: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  cardCount: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  haveCodeLink: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textDecorationLine: "underline",
  },
  codeRow: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  codeInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: "center",
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
});
