import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, AppState, ScrollView, Share, StyleSheet, Text, TextInput, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import type { ShoppingList, ShoppingListItem } from "@smartroute/core/domain/entities/shopping-list";
import type { Store } from "@smartroute/core/domain/entities/store";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { siteUrl } from "@/lib/app-links";
import { Button } from "@/components/Button";
import { ClassificationReviewRow } from "@/components/ClassificationReviewRow";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { setMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

// Same cadence as the accounts feature's shared-list sync.
const SHARED_POLL_MS = 4000;

type LoadState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; store: Store | null };

/**
 * RN port of the web's /my-list/[code] page + MyListEditor. Serves guest lists
 * (no login), a logged-in user's own lists and lists shared with them - access
 * is enforced server-side by GET /api/lists/[code] (resolveListAccess).
 */
export default function MyListScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [listName, setListName] = useState<string | null>(null);
  const [newLinesText, setNewLinesText] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [staleServerList, setStaleServerList] = useState<ShoppingList | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const { status: authStatus } = useAuth();

  const updatedAtRef = useRef(updatedAt);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    updatedAtRef.current = updatedAt;
  }, [updatedAt]);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await apiFetch(`/api/lists/${code}`).catch(() => null);
      if (cancelled) return;
      if (!res || !res.ok) {
        setState({ status: "not_found" });
        return;
      }
      const data: { list: ShoppingList; store: Store | null } = await res.json();
      await setMyListCode(code);
      setIsShared(Boolean(data.list.householdId));
      setListName(data.list.name);
      setItems(data.list.items);
      setUpdatedAt(data.list.updatedAt);

      const productsRes = await apiFetch(`/api/shopping-lists/${data.list.id}`).catch(() => null);
      if (!cancelled && productsRes?.ok) {
        const productsData: { products: Product[] } = await productsRes.json();
        setProducts(productsData.products);
      }
      if (!cancelled) setState({ status: "ready", store: data.store });
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // A shared list is edited by several people - poll for their changes
  // (refetchIfStale never overwrites unsaved local edits; it flags them).
  useEffect(() => {
    if (!isShared || state.status !== "ready") return;
    const interval = setInterval(() => void refetchIfStale(), SHARED_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isShared, state.status, code]);

  // Re-check for updates made by someone else (e.g. another participant of a
  // shared list) when the app returns to the foreground - mirrors web's
  // visibilitychange listener.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || state.status !== "ready") return;
      void refetchIfStale();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, code]);

  async function refetchIfStale() {
    try {
      const res = await apiFetch(`/api/lists/${code}`);
      if (!res.ok) return;
      const data: { list: ShoppingList } = await res.json();
      if (data.list.updatedAt === updatedAtRef.current) return;
      // This list is the widget's (opening it selected it) - show the other
      // participant's change there too, not only on this screen.
      refreshMyListWidget();
      if (hasUnsavedChangesRef.current) {
        setStaleServerList(data.list);
      } else {
        setItems(data.list.items);
        setUpdatedAt(data.list.updatedAt);
      }
    } catch {
      // Best-effort background sync.
    }
  }

  const productsByDepartment = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const list = map.get(p.department) ?? [];
      list.push(p);
      map.set(p.department, list);
    }
    return Array.from(map.entries()).map(([department, departmentProducts]) => ({
      department,
      products: departmentProducts,
    }));
  }, [products]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  function handleChangeProduct(itemId: string, productId: string | null) {
    setHasUnsavedChanges(true);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!productId) {
          return { ...item, classification: { rawText: item.rawText, confidence: 0, source: "unresolved" } };
        }
        return {
          ...item,
          classification: {
            rawText: item.rawText,
            matchedProductId: productId,
            confidence: 1,
            source: item.classification?.source ?? "unresolved",
          },
        };
      }),
    );
  }

  function handleRemove(itemId: string) {
    setHasUnsavedChanges(true);
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  const newRawLines = newLinesText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hasPendingChanges = hasUnsavedChanges || newRawLines.length > 0;

  async function handleSave(force = false): Promise<boolean> {
    setIsSaving(true);
    setError(null);
    setJustSaved(false);
    try {
      const payload = [...items, ...newRawLines.map((rawText) => ({ rawText }))];
      const res = await apiFetch(`/api/lists/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload, expectedUpdatedAt: updatedAt, force }),
      });
      if (res.status === 409) {
        const body: { current: ShoppingList } = await res.json();
        setStaleServerList(body.current);
        setIsSaving(false);
        return false;
      }
      if (!res.ok) throw new Error("save failed");
      const saved: ShoppingList = await res.json();
      setItems(saved.items);
      setUpdatedAt(saved.updatedAt);
      setNewLinesText("");
      setHasUnsavedChanges(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      return true;
    } catch {
      setError(he.common.error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function handleLoadLatest() {
    if (!staleServerList) return;
    setItems(staleServerList.items);
    setUpdatedAt(staleServerList.updatedAt);
    setStaleServerList(null);
    setHasUnsavedChanges(false);
  }

  async function handleShare() {
    // Account lists are shared with specific people (invite + approval) on
    // the sharing screen; a guest list is open to anyone holding its code.
    if (authStatus === "authenticated") {
      router.push(`/sharing/${code}`);
      return;
    }
    try {
      await Share.share({ message: `${he.myList.share.codeLabel(code)}\n${siteUrl(`/my-list/${code}`)}` });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  }

  const unresolvedCount = items.filter((item) => !item.classification?.matchedProductId).length;

  // The branch is picked on the next screen, which builds the route from the
  // saved list - so save pending edits first or they'd be left out.
  async function handleContinueToRoute() {
    if (hasPendingChanges) {
      const saved = await handleSave(false);
      if (!saved) return;
    }
    router.push({ pathname: "/branches", params: { listCode: code } });
  }

  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === "not_found") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{he.myList.notFound.title}</Text>
        <Text style={styles.subtitle}>{he.myList.notFound.subtitle}</Text>
        <Button onPress={() => router.replace("/")}>{he.myList.notFound.backHome}</Button>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{listName ?? he.myList.editor.title}</Text>
        <Text style={styles.subtitle}>{he.myList.editor.subtitle}</Text>
      </View>

      <View style={styles.shareBlock}>
        <Button variant="secondary" onPress={handleShare} fullWidth>
          {authStatus === "authenticated"
            ? he.myList.sharing.buttonLabel
            : shareCopied
              ? he.myList.share.copied
              : he.myList.share.button}
        </Button>
      </View>

      {staleServerList && (
        <View style={styles.staleBox}>
          <Text style={styles.staleText}>{he.myList.editor.staleTitle}</Text>
          <View style={styles.staleActions}>
            <Button variant="secondary" onPress={handleLoadLatest}>
              {he.myList.editor.loadLatest}
            </Button>
            <Button variant="secondary" onPress={() => handleSave(true)} disabled={isSaving}>
              {he.myList.editor.saveAnyway}
            </Button>
          </View>
        </View>
      )}

      <View style={styles.rows}>
        {items.map((item) => (
          <ClassificationReviewRow
            key={item.id}
            item={item}
            productsByDepartment={productsByDepartment}
            productById={productById}
            onChangeProduct={handleChangeProduct}
            onRemove={handleRemove}
          />
        ))}
      </View>

      <TextInput
        value={newLinesText}
        onChangeText={(text) => {
          setNewLinesText(text);
          setHasUnsavedChanges(true);
        }}
        placeholder={he.myList.editor.addItemsPlaceholder}
        placeholderTextColor={COLORS.neutral500}
        multiline
        numberOfLines={3}
        style={styles.textarea}
      />

      {unresolvedCount > 0 && <Text style={styles.unresolvedWarning}>{he.review.unresolvedWarning(unresolvedCount)}</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Only when there's something to save - stays up through the save and
          its brief "saved" confirmation, then hides again. */}
      {(hasPendingChanges || isSaving || justSaved) && (
        <Button onPress={() => handleSave(false)} disabled={isSaving} fullWidth>
          {isSaving ? he.common.loading : justSaved ? he.myList.editor.saved : he.myList.editor.save}
        </Button>
      )}
      <Button
        variant="secondary"
        onPress={handleContinueToRoute}
        disabled={isSaving || items.length + newRawLines.length === 0}
        fullWidth
      >
        {he.review.continueToRoute}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: COLORS.neutral50,
  },
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
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
    textAlign: "center",
  },
  shareBlock: {
    alignItems: "center",
    gap: 6,
  },
  staleBox: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#fffbeb",
    padding: 16,
  },
  staleText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#92400e",
  },
  staleActions: {
    flexDirection: "row",
    gap: 8,
  },
  rows: {
    gap: 12,
  },
  textarea: {
    width: "100%",
    minHeight: 80,
    textAlignVertical: "top",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 14,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  unresolvedWarning: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#b45309",
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
