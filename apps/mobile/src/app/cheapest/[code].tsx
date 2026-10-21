import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ShoppingListItemVariant } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { VariantPickerModal, type VariantOption, type VariantQuestion } from "@/components/VariantPickerModal";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { apiFetch } from "@/lib/api";
import { detectCity, getSavedCity, saveCity } from "@/lib/location";
import { startRouteAtStore } from "@/lib/start-route";

interface City {
  code: number;
  name: string | null;
  branchCount?: number;
}

type CityQuery = { cityCode?: number; cityName?: string; lat?: number; lng?: number };

interface Quote {
  branch: {
    id: number;
    chainName: string;
    name: string;
    address: string | null;
    distanceKm: number | null;
    navioStoreId: string | null;
    pricesAt: string;
  };
  totalAgorot: number;
  estimated: boolean;
  missingItems: { itemId: string; rawText: string }[];
}

interface QuoteResult {
  city: City;
  comparedBranchCount: number;
  quotes: Quote[];
  unpricedItems: { itemId: string; rawText: string }[];
}

type QuoteResponse =
  | ({ status: "ok" } & QuoteResult)
  | { status: "city_not_covered"; city: City; coveredCities: City[] }
  | { status: "city_unknown"; coveredCities: City[] };

type Phase =
  | { kind: "locating" }
  | { kind: "pickCity"; message: string; cities: City[] }
  | { kind: "loading"; message: string }
  | { kind: "refining"; questions: VariantQuestion[]; index: number }
  | { kind: "results"; result: QuoteResult }
  | { kind: "error" };

const shekels = (agorot: number) => `₪${(agorot / 100).toFixed(2)}`;

/** "2026-10-21T04:31:00" -> "21/10 04:31" */
function formatPricesAt(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[2]}/${m[1]} ${m[3]}` : value;
}

/**
 * "The cheapest basket": compares the list's price across the branches in the
 * shopper's city (never across cities), after asking what they meant by generic
 * items ("חלב" -> which milk). Choices are saved on the list items, so they're
 * asked once and the whole household sees them.
 */
export default function CheapestBasketScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const t = he.cheapest;
  const [phase, setPhase] = useState<Phase>({ kind: "locating" });
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [choosingBranch, setChoosingBranch] = useState<number | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const city = useRef<CityQuery | null>(null);
  // Popup answers, also sent with the quote in case saving one on the list failed.
  const choices = useRef(new Map<string, ShoppingListItemVariant>());
  const refined = useRef(false);

  const quote = useCallback(async (): Promise<QuoteResponse> => {
    const res = await apiFetch(`/api/lists/${code}/basket-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...city.current, limit: 3, variants: Object.fromEntries(choices.current) }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [code]);

  const showCityPicker = useCallback(async (message: string, cities?: City[]) => {
    let list = cities;
    if (!list) {
      const res = await apiFetch("/api/price-cities");
      list = res.ok ? ((await res.json()) as { cities: City[] }).cities : [];
    }
    setPhase({ kind: "pickCity", message, cities: list });
  }, []);

  // Quote for the current city; ask the generic-item questions the first time
  // the city turns out to have prices, then quote again with the answers.
  const compare = useCallback(async () => {
    try {
      setPhase({ kind: "loading", message: t.comparing });
      const response = await quote();
      if (response.status === "city_not_covered") {
        await showCityPicker(t.cityNotCovered(response.city.name ?? ""), response.coveredCities);
        return;
      }
      if (response.status === "city_unknown") {
        await showCityPicker(t.cityUnknown, response.coveredCities);
        return;
      }
      if (!refined.current) {
        refined.current = true;
        setPhase({ kind: "loading", message: t.preparing });
        const res = await apiFetch(`/api/lists/${code}/variant-options`);
        const questions: VariantQuestion[] = res.ok ? (await res.json()).items : [];
        if (questions.length > 0) {
          setPhase({ kind: "refining", questions, index: 0 });
          return;
        }
      }
      setPhase({ kind: "results", result: response });
    } catch {
      setPhase({ kind: "error" });
    }
  }, [code, quote, showCityPicker, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectCity();
      if (cancelled) return;
      if (detected.status === "ok") {
        city.current = { cityName: detected.cityName, lat: detected.lat, lng: detected.lng };
        compare();
        return;
      }
      const saved = await getSavedCity();
      if (cancelled) return;
      if (saved) {
        city.current = { cityCode: saved.code };
        compare();
        return;
      }
      showCityPicker(t.pickCityLocationOff).catch(() => setPhase({ kind: "error" }));
    })();
    return () => {
      cancelled = true;
    };
  }, [compare, showCityPicker, t]);

  function pickCity(picked: City) {
    city.current = { cityCode: picked.code };
    saveCity({ code: picked.code, name: picked.name ?? "" });
    compare();
  }

  function answer(questions: VariantQuestion[], from: number, to: number, variantFor: (q: VariantQuestion) => ShoppingListItemVariant) {
    for (const q of questions.slice(from, to)) {
      const variant = variantFor(q);
      choices.current.set(q.itemId, variant);
      // Saved on the list item (shared with the household); the quote doesn't wait for it.
      apiFetch(`/api/lists/${code}/items/${q.itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      }).catch(() => {});
    }
    if (to >= questions.length) compare();
    else setPhase({ kind: "refining", questions, index: to });
  }

  const anyVariant = (q: VariantQuestion): ShoppingListItemVariant => ({
    kind: "any",
    productId: q.productId,
    chosenAt: new Date().toISOString(),
  });

  async function chooseBranch(q: Quote) {
    setRouteError(null);
    if (q.branch.navioStoreId) {
      setChoosingBranch(q.branch.id);
      const result = await startRouteAtStore(code, q.branch.navioStoreId);
      setChoosingBranch(null);
      if ("error" in result) setRouteError(result.error);
      else router.push(`/route/${result.routeId}`);
      return;
    }
    router.push({ pathname: "/checklist/[code]", params: { code, branchName: `${q.branch.chainName} · ${q.branch.name}` } });
  }

  function toggleMissing(branchId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(branchId)) next.delete(branchId);
      else next.add(branchId);
      return next;
    });
  }

  const question = phase.kind === "refining" ? phase.questions[phase.index] : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.page} persistentScrollbar>
      <View style={styles.header}>
        <Text style={styles.title}>{t.title}</Text>
        {phase.kind === "results" && (
          <View style={styles.cityRow}>
            <Text style={styles.subtitle}>
              {t.resultsTitle(phase.result.city.name ?? "")} · {t.comparedBranches(phase.result.comparedBranchCount)}
            </Text>
            <Pressable onPress={() => showCityPicker(t.pickCityTitle)} hitSlop={8} accessibilityRole="button">
              <Text style={styles.link}>{t.changeCity}</Text>
            </Pressable>
          </View>
        )}
      </View>

      {(phase.kind === "locating" || phase.kind === "loading" || phase.kind === "refining") && (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.hint}>{phase.kind === "loading" ? phase.message : t.locating}</Text>
        </View>
      )}

      {phase.kind === "error" && (
        <View style={styles.center}>
          <Text style={styles.hint}>{t.loadFailed}</Text>
          <Button variant="secondary" onPress={() => (city.current ? compare() : showCityPicker(t.pickCityTitle))}>
            {t.retry}
          </Button>
        </View>
      )}

      {phase.kind === "pickCity" && (
        <View style={styles.list}>
          <Text style={styles.sectionTitle}>{t.pickCityTitle}</Text>
          <Text style={styles.hint}>{phase.message}</Text>
          {phase.cities.map((c) => (
            <Pressable
              key={c.code}
              onPress={() => pickCity(c)}
              style={({ pressed }) => [styles.cityOption, pressed && styles.cityOptionPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.cityName}>{c.name}</Text>
              {c.branchCount ? <Text style={styles.hint}>{t.comparedBranches(c.branchCount)}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      {phase.kind === "results" && (
        <View style={styles.list}>
          {phase.result.quotes.length === 0 && <Text style={styles.hint}>{t.noBranches}</Text>}
          {routeError && <Text style={styles.errorText}>{routeError}</Text>}
          {phase.result.quotes.map((q, i) => {
            const missing = q.missingItems.length;
            const open = expanded.has(q.branch.id);
            return (
              <Card key={q.branch.id} style={[styles.quoteCard, i === 0 && styles.bestCard]}>
                <View style={styles.quoteTop}>
                  <View style={styles.quoteNames}>
                    <Text style={styles.chain}>{q.branch.chainName}</Text>
                    <Text style={styles.branchName}>{q.branch.name}</Text>
                    {q.branch.address ? <Text style={styles.hint}>{q.branch.address}</Text> : null}
                  </View>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>{t.total}</Text>
                    <Text style={styles.total}>{shekels(q.totalAgorot)}</Text>
                  </View>
                </View>

                {missing > 0 ? (
                  <Pressable onPress={() => toggleMissing(q.branch.id)} hitSlop={6} accessibilityRole="button">
                    <Text style={styles.missing}>
                      {t.missing(missing)} {open ? "▴" : "▾"}
                    </Text>
                    {open && <Text style={styles.missingList}>{q.missingItems.map((m) => m.rawText).join(" · ")}</Text>}
                  </Pressable>
                ) : (
                  <Text style={styles.allHere}>✓ {t.allItemsHere}</Text>
                )}

                <Text style={styles.meta}>
                  {t.pricesAt(formatPricesAt(q.branch.pricesAt))}
                  {q.branch.distanceKm !== null ? ` · ${q.branch.distanceKm} ק"מ` : ""}
                </Text>

                <Button onPress={() => chooseBranch(q)} disabled={choosingBranch !== null} fullWidth>
                  {choosingBranch === q.branch.id ? he.common.loading : t.chooseBranch}
                </Button>
              </Card>
            );
          })}

          {phase.result.quotes.some((q) => q.estimated) && <Text style={styles.note}>~ {t.estimated}</Text>}
          {phase.result.unpricedItems.length > 0 && (
            <Text style={styles.note}>{t.unpriced(phase.result.unpricedItems.map((u) => u.rawText).join(", "))}</Text>
          )}
          <Text style={styles.disclaimer}>{t.disclaimer}</Text>
        </View>
      )}

      <VariantPickerModal
        question={question}
        index={phase.kind === "refining" ? phase.index : 0}
        total={phase.kind === "refining" ? phase.questions.length : 0}
        onPick={(option: VariantOption) => {
          if (phase.kind !== "refining") return;
          const q = phase.questions[phase.index];
          answer(phase.questions, phase.index, phase.index + 1, () => ({
            kind: "sku",
            productId: q.productId,
            itemKey: option.itemKey,
            name: option.name,
            chosenAt: new Date().toISOString(),
          }));
        }}
        onAny={() => phase.kind === "refining" && answer(phase.questions, phase.index, phase.index + 1, anyVariant)}
        onAnyForRest={() => phase.kind === "refining" && answer(phase.questions, phase.index, phase.questions.length, anyVariant)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  subtitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  link: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  center: {
    paddingVertical: 32,
    gap: 12,
    alignItems: "center",
  },
  hint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  errorText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
    textAlign: "center",
  },
  list: {
    gap: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  cityOption: {
    gap: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cityOptionPressed: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  cityName: {
    fontSize: 16,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  quoteCard: {
    gap: 10,
  },
  bestCard: {
    borderColor: COLORS.cyan500,
    borderWidth: 2,
  },
  quoteTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  quoteNames: {
    flex: 1,
    gap: 2,
  },
  chain: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  branchName: {
    fontSize: 15,
    fontFamily: FONTS.medium,
    color: COLORS.neutral700,
  },
  totalBox: {
    alignItems: "flex-end",
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  total: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: COLORS.cyan700,
  },
  missing: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: "#b45309",
  },
  missingList: {
    marginTop: 4,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  allHere: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.green600,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  note: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
