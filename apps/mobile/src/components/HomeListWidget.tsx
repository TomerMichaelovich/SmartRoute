import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { CATEGORY_ICON, COLLAPSED_ITEM_COUNT } from "@/lib/list-widget-shared";
import { clearMyListCode, getMyListCode, setMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

function MenuIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.cyan700} strokeWidth={2}>
      <Path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
    </Svg>
  );
}

function MicIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke={COLORS.white} strokeWidth={2}>
      <Path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" strokeLinejoin="round" />
      <Path d="M6 11a6 6 0 0 0 12 0M12 17v3" strokeLinecap="round" />
    </Svg>
  );
}

export function HomeListWidget({ loggedIn = false }: { loggedIn?: boolean }) {
  const router = useRouter();
  const [myList, setMyList] = useState<{ list: ShoppingList; store: Store | null } | null>(null);
  const [checked, setChecked] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // For a logged-in user the account's active list is authoritative (works
    // across devices, matches the web home page's serverMyList); guests fall
    // back to the locally-held shareCode - mirrors web's HomeListWidget.
    async function loadMyList() {
      if (loggedIn) {
        try {
          const res = await apiFetch("/api/lists/mine");
          if (res.ok) {
            const data: { list: ShoppingList | null; store: Store | null } = await res.json();
            if (data.list) {
              setMyList({ list: data.list, store: data.store });
              if (data.list.shareCode) await setMyListCode(data.list.shareCode);
            }
          }
        } catch {
          // Best-effort - the widget just won't show if this fails.
        }
        setChecked(true);
        return;
      }

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
    setChecked(false);
    setMyList(null);
    loadMyList();
  }, [loggedIn]);

  // Needed only for each item's icon/name (matched product's category + canonicalName) -
  // same catalog fetch my-list/[code].tsx and household/list.tsx already do.
  useEffect(() => {
    const listId = myList?.list.id;
    if (!listId) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/api/shopping-lists/${listId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { products: Product[] } | null) => {
        if (!cancelled && data) setProducts(data.products);
      })
      .catch(() => {
        // Best-effort - items just fall back to their raw text/generic icon.
      });
    return () => {
      cancelled = true;
    };
  }, [myList?.list.id]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function handleOpenByCode() {
    const normalized = normalizeShareCode(codeInput);
    if (!normalized) return;
    router.push(`/my-list/${normalized}`);
  }

  function openFullList() {
    if (myList?.list.shareCode) router.push(`/my-list/${myList.list.shareCode}`);
  }

  async function toggleItemChecked(item: ShoppingListItem) {
    const shareCode = myList?.list.shareCode;
    if (!shareCode) return;
    const nextChecked = !item.checked;
    setMyList((prev) =>
      prev
        ? {
            ...prev,
            list: {
              ...prev.list,
              items: prev.list.items.map((it) => (it.id === item.id ? { ...it, checked: nextChecked } : it)),
            },
          }
        : prev,
    );
    try {
      await apiFetch(`/api/lists/${shareCode}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checked: nextChecked }),
      });
      refreshMyListWidget();
    } catch {
      // Best-effort - a later reload will reconcile if this silently failed.
    }
  }

  // Avoid a layout flash while the AsyncStorage/fetch check is in flight.
  if (!checked) return null;

  if (myList) {
    const items = myList.list.items;
    const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
    const hiddenCount = items.length - visibleItems.length;

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerStart} onPress={openFullList} hitSlop={6}>
            <MenuIcon />
            <Text style={styles.cardTitle}>{he.myList.widgetTitle}</Text>
          </Pressable>
          <Text style={styles.cardCount}>{he.myList.widget.productCount(items.length)}</Text>
        </View>

        <View style={styles.actionRow}>
          <Button style={styles.addButton} onPress={openFullList}>
            {`+ ${he.myList.widget.addProduct}`}
          </Button>
          <Pressable
            style={styles.micButton}
            onPress={() => Alert.alert(he.myList.widget.micComingSoon)}
            accessibilityLabel={he.myList.widget.micAccessibilityLabel}
          >
            <MicIcon />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>{he.myList.itemCount(0)}</Text>
        ) : (
          <>
            <View style={styles.itemsList}>
              {visibleItems.map((item) => {
                const product = item.classification?.matchedProductId
                  ? productById.get(item.classification.matchedProductId)
                  : undefined;
                const name = product?.canonicalName ?? item.rawText;
                const icon = CATEGORY_ICON[product?.category ?? "other"];
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <Pressable
                      onPress={() => toggleItemChecked(item)}
                      style={[styles.checkbox, item.checked && styles.checkboxChecked]}
                      hitSlop={8}
                    >
                      {item.checked && <Text style={styles.checkboxMark}>✓</Text>}
                    </Pressable>
                    <View style={styles.itemIcon}>
                      <Text style={styles.itemIconText}>{icon}</Text>
                    </View>
                    <Text style={[styles.itemName, item.checked && styles.itemNameChecked]} numberOfLines={1}>
                      {name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {items.length > COLLAPSED_ITEM_COUNT && (
              <Pressable style={styles.expandRow} onPress={() => setExpanded((v) => !v)}>
                <Text style={styles.expandText}>
                  {expanded ? he.myList.widget.showLess : he.myList.widget.moreCount(hiddenCount)}
                </Text>
                <Text style={styles.expandChevron}>{expanded ? "︿" : "⌄"}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
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
  // rounded-2xl bg-white p-4 text-right shadow-sm"> but now hosts several
  // independent tap targets (header, add button, mic, checkboxes, expand) so
  // it can no longer be a single outer Link/Pressable.
  card: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "column",
    gap: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerStart: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  cardCount: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addButton: {
    flex: 1,
  },
  micButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cyan600,
    alignItems: "center",
    justifyContent: "center",
  },
  itemsList: {
    gap: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.neutral300,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.cyan600,
    borderColor: COLORS.cyan600,
  },
  checkboxMark: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: COLORS.cyan50,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconText: {
    fontSize: 15,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  itemNameChecked: {
    color: COLORS.neutral300,
    textDecorationLine: "line-through",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textAlign: "center",
    paddingVertical: 4,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 6,
  },
  expandText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  expandChevron: {
    fontSize: 13,
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
