import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export interface BranchQuote {
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
  fullBasketAgorot: number;
  estimated: boolean;
  missingItems: { itemId: string; rawText: string; estimatedAgorot: number }[];
  lines: { itemId: string; name: string; quantity: number; priceAgorot: number; lineTotalAgorot: number }[];
}

export const shekels = (agorot: number) => `₪${(agorot / 100).toFixed(2)}`;

/** "2026-10-21T04:31:00" -> "21/10 04:31" */
function formatPricesAt(value: string): string {
  const m = value.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[2]}/${m[1]} ${m[3]}` : value;
}

interface BranchQuoteCardProps {
  quote: BranchQuote;
  rank: number;
  busy: boolean;
  disabled: boolean;
  onBuyHere: () => void;
}

/**
 * One branch in the cheapest-basket results: rank, branch, full-basket price
 * and coverage on two compact lines, with the price breakdown on demand.
 */
export function BranchQuoteCard({ quote, rank, busy, disabled, onBuyHere }: BranchQuoteCardProps) {
  const t = he.cheapest;
  const [open, setOpen] = useState(false);
  const missing = quote.missingItems.length;
  const best = rank === 1;

  return (
    <View
      style={[styles.card, best && styles.bestCard]}
      accessible={false}
    >
      <View
        style={styles.summary}
        accessible
        accessibilityLabel={t.branchSummary(rank, quote.branch.chainName, quote.branch.name, shekels(quote.fullBasketAgorot), missing)}
      >
        <View style={[styles.rank, best && styles.bestRank]}>
          <Text style={[styles.rankText, best && styles.bestRankText]}>{rank}</Text>
        </View>
        <View style={styles.names}>
          <Text style={styles.chain} numberOfLines={1}>
            {quote.branch.chainName}
            <Text style={styles.branchName}> · {quote.branch.name}</Text>
          </Text>
          <Text style={[styles.coverage, missing > 0 ? styles.coverageMissing : styles.coverageFull]} numberOfLines={1}>
            {missing > 0 ? t.missingShort(missing) : `✓ ${t.allItemsHere}`}
            <Text style={styles.meta}>
              {"  ·  "}
              {t.pricesAt(formatPricesAt(quote.branch.pricesAt))}
              {quote.branch.distanceKm !== null ? `  ·  ${quote.branch.distanceKm} ק"מ` : ""}
            </Text>
          </Text>
        </View>
        <Text style={[styles.price, best && styles.bestPrice]}>
          {missing > 0 || quote.estimated ? "~" : ""}
          {shekels(quote.fullBasketAgorot)}
        </Text>
      </View>

      {open && (
        <View style={styles.breakdown}>
          {quote.lines.map((line) => (
            <View key={line.itemId} style={styles.line}>
              <Text style={styles.lineName} numberOfLines={1}>
                {line.name}
              </Text>
              {line.quantity !== 1 && <Text style={styles.lineQty}>×{line.quantity}</Text>}
              <Text style={styles.linePrice}>{shekels(line.lineTotalAgorot)}</Text>
            </View>
          ))}
          {quote.missingItems.map((item) => (
            <View key={item.itemId} style={styles.line}>
              <Text style={[styles.lineName, styles.missingName]} numberOfLines={1}>
                {item.rawText} · {t.notSoldHere}
              </Text>
              <Text style={[styles.linePrice, styles.missingName]}>~{shekels(item.estimatedAgorot)}</Text>
            </View>
          ))}
          {missing > 0 && <Text style={styles.meta}>{t.missingEstimated}</Text>}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={({ pressed }) => [styles.action, styles.secondaryAction, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <Text style={styles.secondaryActionText}>
            {open ? t.hideBreakdown : t.breakdown} {open ? "▴" : "▾"}
          </Text>
        </Pressable>
        <Pressable
          onPress={onBuyHere}
          disabled={disabled}
          style={({ pressed }) => [
            styles.action,
            styles.primaryAction,
            disabled && styles.disabledAction,
            pressed && styles.primaryPressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled, busy }}
        >
          {busy ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryActionText}>{t.buyHere}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bestCard: {
    borderColor: COLORS.cyan500,
    borderWidth: 1.5,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.neutral100,
  },
  bestRank: {
    backgroundColor: COLORS.cyan600,
  },
  rankText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: COLORS.neutral600,
  },
  bestRankText: {
    color: COLORS.white,
  },
  names: {
    flex: 1,
    gap: 1,
  },
  chain: {
    fontSize: 15,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  branchName: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  coverage: {
    fontSize: 12,
    fontFamily: FONTS.medium,
  },
  coverageFull: {
    color: COLORS.green600,
  },
  coverageMissing: {
    color: "#b45309",
  },
  meta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  price: {
    fontSize: 17,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  bestPrice: {
    color: COLORS.cyan700,
  },
  breakdown: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
    paddingTop: 8,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lineName: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral700,
  },
  lineQty: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  linePrice: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  missingName: {
    color: "#b45309",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  action: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
  },
  pressed: {
    backgroundColor: COLORS.neutral100,
  },
  secondaryActionText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral700,
  },
  primaryAction: {
    backgroundColor: COLORS.cyan600,
  },
  primaryPressed: {
    backgroundColor: COLORS.cyan700,
  },
  disabledAction: {
    backgroundColor: COLORS.neutral300,
  },
  primaryActionText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.white,
  },
});
