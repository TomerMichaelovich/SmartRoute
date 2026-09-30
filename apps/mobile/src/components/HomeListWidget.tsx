import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { normalizeShareCode } from "@smartroute/core/application/shopping-list/generate-share-code";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { RenameListModal } from "@/components/RenameListModal";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { CATEGORY_ICON, COLLAPSED_ITEM_COUNT } from "@/lib/list-widget-shared";
import { clearMyListCode, getMyListCode, setMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

function MoreIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20} fill={COLORS.neutral500}>
      <Circle cx={5} cy={12} r={1.75} />
      <Circle cx={12} cy={12} r={1.75} />
      <Circle cx={19} cy={12} r={1.75} />
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

function PeopleIcon({ color }: { color: string }) {
  return (
    <Svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke={color} strokeWidth={2}>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M2.5 20a6.5 6.5 0 0 1 13 0" strokeLinecap="round" />
      <Path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" strokeLinecap="round" />
    </Svg>
  );
}

interface ListSharingSummary {
  role: "owner" | "member";
  memberCount: number;
  pendingCount: number;
}

const OWN_UNSHARED: ListSharingSummary = { role: "owner", memberCount: 1, pendingCount: 0 };

// Same cadence as the list editor's shared-list sync.
const SHARED_POLL_MS = 4000;

interface MineResponse {
  lists?: ShoppingList[];
  list: ShoppingList | null;
  sharing?: Record<string, ListSharingSummary>;
}

/** What the home screen shows of the account's lists - a change means someone edited something. */
function mineSignature(data: MineResponse): string {
  const lists = (data.lists ?? []).map((l) => `${l.id}:${l.updatedAt}:${l.name ?? ""}`).sort();
  return JSON.stringify([lists, data.sharing ?? {}]);
}

// Invite codes (household/join links) are 8 characters; list share codes are 6.
const INVITE_CODE_LENGTH = 8;

function listDisplayName(list: ShoppingList): string {
  return list.name ?? he.myList.defaultName();
}

/**
 * The home screen's list area. One primary action per state:
 * - no list yet: create one;
 * - a list is selected: go shopping with it (adding products is the lighter,
 *   input-styled row above the items).
 * Account holders may keep several open lists (a weekly shop, a party list...)
 * and switch between them with the chips row - their own and the ones shared
 * with them; the card's participants button opens each list's sharing panel.
 * Guests have a single list.
 * The selected list is also what the Android home-screen widget shows.
 */
export function HomeListWidget({
  loggedIn = false,
  onHasListChange,
}: {
  loggedIn?: boolean;
  onHasListChange?: (hasList: boolean) => void;
}) {
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [sharing, setSharing] = useState<Record<string, ListSharingSummary>>({});
  const lastMineSignature = useRef("");

  // Oldest first, so chips keep their place instead of jumping around every
  // time a list is edited. Keeps the stored selection while it's still open.
  const applyMine = useCallback(async (data: MineResponse, storedCode: string | null) => {
    const open = (data.lists ?? (data.list ? [data.list] : [])).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const selected =
      open.find((l) => l.shareCode === storedCode) ??
      [...open].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    lastMineSignature.current = mineSignature(data);
    setLists(open);
    setSharing(data.sharing ?? {});
    setSelectedCode(selected?.shareCode ?? null);
    if (selected?.shareCode && selected.shareCode !== storedCode) {
      await setMyListCode(selected.shareCode);
    }
  }, []);

  // Logged in: the account's open lists are authoritative (works across
  // devices); the locally-held shareCode only remembers which one is
  // selected. Guests: the locally-held shareCode is their one list.
  const loadLists = useCallback(async () => {
    const storedCode = await getMyListCode();

    if (loggedIn) {
      try {
        const res = await apiFetch("/api/lists/mine");
        if (res.ok) await applyMine(await res.json(), storedCode);
      } catch {
        // Best-effort - the empty state shows if this fails.
      }
      setChecked(true);
      refreshMyListWidget();
      return;
    }

    if (!storedCode) {
      setLists([]);
      setSelectedCode(null);
    } else {
      try {
        const res = await apiFetch(`/api/lists/${storedCode}`);
        if (res.ok) {
          const data: { list: ShoppingList } = await res.json();
          setLists([data.list]);
          setSelectedCode(storedCode);
        } else {
          await clearMyListCode();
          setLists([]);
          setSelectedCode(null);
        }
      } catch {
        // Best-effort - the widget just won't show if this fails.
      }
    }
    setChecked(true);
    // Android only redraws the home-screen widget when asked, so sync it on
    // every visit - picks up renames/edits made elsewhere and app updates.
    refreshMyListWidget();
  }, [loggedIn, applyMine]);

  // Start from a blank slate when the login state flips (a different user's
  // lists must not linger)...
  useEffect(() => {
    setChecked(false);
    setLists([]);
    setSelectedCode(null);
  }, [loggedIn]);

  // ...and reload whenever the home screen comes back into focus, so a list
  // created, edited or finished on another screen shows up without a restart.
  useFocusEffect(
    useCallback(() => {
      loadLists();
    }, [loadLists]),
  );

  const selected = lists.find((l) => l.shareCode === selectedCode) ?? null;

  // While the home screen is open, pick up other participants' edits to
  // shared lists (and new join requests) within seconds. Only when some list
  // is shared - nobody else can change a private list.
  const hasShared = loggedIn && lists.some((l) => l.householdId);
  useFocusEffect(
    useCallback(() => {
      if (!hasShared) return;
      const interval = setInterval(async () => {
        if (AppState.currentState !== "active") return;
        try {
          const res = await apiFetch("/api/lists/mine");
          if (!res.ok) return;
          const data: MineResponse = await res.json();
          if (mineSignature(data) === lastMineSignature.current) return;
          await applyMine(data, await getMyListCode());
          refreshMyListWidget();
        } catch {
          // Best-effort background sync - the next tick retries.
        }
      }, SHARED_POLL_MS);
      return () => clearInterval(interval);
    }, [hasShared, applyMine]),
  );

  useEffect(() => {
    if (checked) onHasListChange?.(Boolean(selected));
  }, [checked, selected, onHasListChange]);

  // Needed only for each item's icon/name (matched product's category + canonicalName) -
  // same catalog fetch my-list/[code].tsx and household/list.tsx already do.
  useEffect(() => {
    const listId = selected?.id;
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
  }, [selected?.id]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function patchList(code: string, patch: (list: ShoppingList) => ShoppingList | null) {
    setLists((prev) =>
      prev.flatMap((l) => {
        if (l.shareCode !== code) return [l];
        const next = patch(l);
        return next ? [next] : [];
      }),
    );
  }

  function handleOpenByCode() {
    const normalized = normalizeShareCode(codeInput);
    if (!normalized) return;
    if (normalized.length === INVITE_CODE_LENGTH) {
      router.push({ pathname: "/household/join", params: { code: normalized } });
    } else {
      router.push(`/my-list/${normalized}`);
    }
  }

  async function selectList(list: ShoppingList) {
    if (!list.shareCode || list.shareCode === selectedCode) return;
    setSelectedCode(list.shareCode);
    setExpanded(false);
    await setMyListCode(list.shareCode);
    refreshMyListWidget();
  }

  function openFullList() {
    if (selected?.shareCode) router.push(`/my-list/${selected.shareCode}`);
  }

  function openSharing() {
    if (selected?.shareCode) router.push(`/sharing/${selected.shareCode}`);
  }

  function goShopping() {
    if (selected?.shareCode) router.push({ pathname: "/branches", params: { listCode: selected.shareCode } });
  }

  async function handleRename(name: string) {
    const shareCode = selected?.shareCode;
    if (!shareCode) return;
    try {
      const res = await apiFetch(`/api/lists/${shareCode}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      patchList(shareCode, (l) => ({ ...l, name }));
      setRenaming(false);
      refreshMyListWidget();
    } catch {
      Alert.alert(he.common.error);
    }
  }

  async function handleDelete(list: ShoppingList) {
    const shareCode = list.shareCode;
    if (!shareCode) return;
    try {
      const res = await apiFetch(`/api/lists/${shareCode}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      Alert.alert(he.common.error);
      return;
    }
    const remaining = lists.filter((l) => l.shareCode !== shareCode);
    setLists(remaining);
    const next = remaining[remaining.length - 1] ?? null;
    setSelectedCode(next?.shareCode ?? null);
    setExpanded(false);
    if (next?.shareCode) await setMyListCode(next.shareCode);
    else await clearMyListCode();
    refreshMyListWidget();
  }

  function openListMenu(list: ShoppingList) {
    Alert.alert(listDisplayName(list), undefined, [
      { text: he.myList.manage.rename, onPress: () => setRenaming(true) },
      {
        text: he.myList.manage.delete,
        style: "destructive",
        onPress: () =>
          Alert.alert(he.myList.manage.delete, he.myList.manage.deleteConfirm, [
            { text: he.myList.manage.cancel, style: "cancel" },
            { text: he.myList.manage.delete, style: "destructive", onPress: () => handleDelete(list) },
          ]),
      },
      { text: he.myList.manage.cancel, style: "cancel" },
    ]);
  }

  // Avoid a layout flash while the AsyncStorage/fetch check is in flight.
  if (!checked) return null;

  const codeEntry = (
    <View style={styles.container}>
      {!showCodeInput ? (
        <Pressable onPress={() => setShowCodeInput(true)} hitSlop={8}>
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

  if (!selected) {
    if (!loggedIn) return codeEntry;
    return (
      <View style={styles.section}>
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>{he.home.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{he.home.emptyBody}</Text>
          <Button fullWidth onPress={() => router.push("/list/new")}>
            {he.home.emptyCta}
          </Button>
        </View>
        {codeEntry}
      </View>
    );
  }

  const items = selected.items;
  const selectedSharing = sharing[selected.id] ?? OWN_UNSHARED;
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <View style={styles.section}>
      {loggedIn && (
        <>
          <Text style={styles.sectionTitle}>{he.home.myLists}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}
          >
            {lists.map((list) => {
              const isSelected = list.shareCode === selected.shareCode;
              return (
                <Pressable
                  key={list.id}
                  onPress={() => selectList(list)}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]} numberOfLines={1}>
                    {(sharing[list.id]?.memberCount ?? 1) > 1 ? `👥 ${listDisplayName(list)}` : listDisplayName(list)}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push("/list/new")}
              style={[styles.chip, styles.chipNew]}
              accessibilityRole="button"
            >
              <Text style={styles.chipNewText}>{`+ ${he.myList.manage.newList}`}</Text>
            </Pressable>
          </ScrollView>
        </>
      )}

      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerStart} onPress={openFullList} hitSlop={6}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {listDisplayName(selected)}
            </Text>
            <Text style={styles.cardCount}>{he.myList.widget.productCount(items.length)}</Text>
          </Pressable>
          {loggedIn && (
            <View style={styles.headerEnd}>
              {/* Who takes part + inviting - the list's sharing panel. */}
              <Pressable
                onPress={openSharing}
                hitSlop={8}
                style={[styles.peopleButton, selectedSharing.memberCount > 1 && styles.peopleButtonShared]}
                accessibilityRole="button"
                accessibilityLabel={he.myList.sharing.buttonLabel}
              >
                <PeopleIcon color={COLORS.cyan700} />
                {selectedSharing.memberCount > 1 && (
                  <Text style={styles.peopleCount}>{selectedSharing.memberCount}</Text>
                )}
                {selectedSharing.pendingCount > 0 && <View style={styles.pendingDot} />}
              </Pressable>
              {selectedSharing.role === "owner" && (
                <Pressable
                  onPress={() => openListMenu(selected)}
                  hitSlop={10}
                  style={styles.menuButton}
                  accessibilityLabel={he.myList.widget.menuAccessibilityLabel}
                >
                  <MoreIcon />
                </Pressable>
              )}
            </View>
          )}
        </View>

        {loggedIn && selectedSharing.pendingCount > 0 && (
          <Pressable style={styles.pendingBanner} onPress={openSharing} accessibilityRole="button">
            <Text style={styles.pendingBannerText}>{he.myList.sharing.pendingCount(selectedSharing.pendingCount)}</Text>
            <Text style={styles.pendingBannerAction}>{he.myList.sharing.approve}</Text>
          </Pressable>
        )}

        {/* Styled as an input, not a button, so it doesn't compete with the
            card's one primary action ("go shopping") below. */}
        <View style={styles.actionRow}>
          <Pressable style={styles.addField} onPress={openFullList} accessibilityRole="button">
            <Text style={styles.addFieldPlus}>+</Text>
            <Text style={styles.addFieldText}>{he.myList.widget.addProductPlaceholder}</Text>
          </Pressable>
          <Pressable
            style={styles.micButton}
            onPress={() => Alert.alert(he.myList.widget.micComingSoon)}
            accessibilityLabel={he.myList.widget.micAccessibilityLabel}
          >
            <MicIcon />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={styles.emptyText}>{he.myList.widget.emptyListHint}</Text>
        ) : (
          <>
            <View style={styles.itemsList}>
              {visibleItems.map((item) => {
                const product = item.classification?.matchedProductId
                  ? productById.get(item.classification.matchedProductId)
                  : undefined;
                const name = product?.canonicalName ?? item.rawText;
                const icon = CATEGORY_ICON[product?.category ?? "other"];
                // No checkbox: the list is for writing only - items are marked
                // as collected on the route screen, which tracks that itself.
                return (
                  <Pressable key={item.id} style={styles.itemRow} onPress={openFullList}>
                    <View style={styles.itemIcon}>
                      <Text style={styles.itemIconText}>{icon}</Text>
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {name}
                    </Text>
                  </Pressable>
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

        <Button fullWidth onPress={goShopping} disabled={items.length === 0}>
          {he.home.goShopping}
        </Button>
      </View>

      <RenameListModal
        visible={renaming}
        initialName={selected.name ?? ""}
        onCancel={() => setRenaming(false)}
        onSave={handleRename}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    maxWidth: 180,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: COLORS.cyan600,
    borderColor: COLORS.cyan600,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  chipTextSelected: {
    color: COLORS.white,
  },
  chipNew: {
    borderStyle: "dashed",
    borderColor: COLORS.cyan600,
    backgroundColor: "transparent",
  },
  chipNewText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
  container: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  // Hosts several independent tap targets (title, add row, mic, item rows,
  // expand, go shopping), so it can't be a single outer Pressable.
  card: {
    width: "100%",
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
  emptyCard: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
    textAlign: "center",
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerStart: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    flexShrink: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
    flexShrink: 1,
  },
  cardCount: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  headerEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  peopleButton: {
    minWidth: 36,
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  peopleButtonShared: {
    backgroundColor: COLORS.cyan50,
  },
  peopleCount: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
  pendingDot: {
    position: "absolute",
    top: 2,
    end: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#dc2626",
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingBannerText: {
    flexShrink: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#92400e",
  },
  pendingBannerAction: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan700,
  },
  menuButton: {
    padding: 4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addField: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.neutral50,
    paddingHorizontal: 14,
  },
  addFieldPlus: {
    fontSize: 20,
    fontFamily: FONTS.semiBold,
    color: COLORS.cyan600,
  },
  addFieldText: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
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
