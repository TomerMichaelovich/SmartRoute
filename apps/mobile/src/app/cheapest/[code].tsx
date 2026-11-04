import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ShoppingListItemVariant } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { BranchQuoteCard, type BranchQuote } from "@/components/BranchQuoteCard";
import { Button } from "@/components/Button";
import { VariantPickerModal, type VariantOption, type VariantQuestion } from "@/components/VariantPickerModal";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { apiFetch } from "@/lib/api";
import { detectCity, getSavedCity, saveCity } from "@/lib/location";
import { useRouteStarter } from "@/lib/use-route-starter";

interface City {
  code: number;
  name: string | null;
  branchCount?: number;
}

type CityQuery = { cityCode?: number; cityName?: string; lat?: number; lng?: number };

interface QuoteResult {
  city: City;
  comparedBranchCount: number;
  /** Every branch in the city, cheapest full basket first. */
  quotes: BranchQuote[];
  /** name: the refinement pick if there was one, else rawText. Absent from older servers. */
  unpricedItems: { itemId: string; rawText: string; name?: string }[];
}

/** Shown before "show the other branches". */
const TOP_COUNT = 3;
/** Ask for every branch at once: revealing the rest needs no second request. */
const MAX_BRANCHES = 50;

/** No item priced at any branch (e.g. its products aren't linked to barcodes yet): ₪0 cards would mislead. */
const nothingPriced = (result: QuoteResult) => result.quotes.every((q) => q.lines.length === 0 && q.missingItems.length === 0);

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
  const [showAll, setShowAll] = useState(false);
  const [choosingBranch, setChoosingBranch] = useState<number | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const city = useRef<CityQuery | null>(null);
  // Popup answers, also sent with the quote in case saving one on the list failed.
  const choices = useRef(new Map<string, ShoppingListItemVariant>());
  const refined = useRef(false);
  const { startRoute, choiceModal } = useRouteStarter(code);

  const quote = useCallback(async (): Promise<QuoteResponse> => {
    const res = await apiFetch(`/api/lists/${code}/basket-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...city.current, limit: MAX_BRANCHES, variants: Object.fromEntries(choices.current) }),
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

  async function chooseBranch(q: BranchQuote) {
    setRouteError(null);
    if (q.branch.navioStoreId) {
      setChoosingBranch(q.branch.id);
      const result = await startRoute(q.branch.navioStoreId);
      setChoosingBranch(null);
      if ("error" in result) setRouteError(result.error);
      else router.push(`/route/${result.routeId}`);
      return;
    }
    router.push({ pathname: "/checklist/[code]", params: { code, branchName: `${q.branch.chainName} · ${q.branch.name}` } });
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
          {/* Up front, not under the cards: these items are in no total. */}
          {phase.result.unpricedItems.length > 0 && (
            <Text style={styles.warning}>{t.unpriced(phase.result.unpricedItems.map((u) => u.name ?? u.rawText).join(", "))}</Text>
          )}
          {nothingPriced(phase.result) && <Text style={styles.hint}>{t.nothingPriced}</Text>}
          {/* Cheapest full basket first, all the way down. */}
          {(nothingPriced(phase.result) ? [] : showAll ? phase.result.quotes : phase.result.quotes.slice(0, TOP_COUNT)).map((q, i) => (
            <BranchQuoteCard
              key={q.branch.id}
              quote={q}
              unpriced={phase.result.unpricedItems}
              rank={i + 1}
              busy={choosingBranch === q.branch.id}
              disabled={choosingBranch !== null}
              onBuyHere={() => chooseBranch(q)}
            />
          ))}

          {phase.result.quotes.length > TOP_COUNT && !nothingPriced(phase.result) && (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              style={({ pressed }) => [styles.moreButton, pressed && styles.cityOptionPressed]}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll }}
            >
              <Text style={styles.moreText}>
                {showAll ? t.showLess : t.showMore(phase.result.quotes.length - TOP_COUNT)} {showAll ? "▴" : "▾"}
              </Text>
            </Pressable>
          )}

          {phase.result.quotes.some((q) => q.estimated) && <Text style={styles.note}>{t.estimated}</Text>}
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
      {choiceModal}
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
  moreButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
  },
  moreText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  note: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  warning: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: "#b45309",
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
