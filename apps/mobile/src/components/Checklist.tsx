import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RouteStop } from "@smartroute/core/domain/entities/route";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { ChecklistItem } from "./ChecklistItem";

export interface ChecklistStopView {
  stop: RouteStop;
  items: Array<{ id: string; displayName: string; imageUrl?: string }>;
}

interface ChecklistProps {
  stopViews: ChecklistStopView[];
  checkedItemIds: Set<string>;
  notFoundItemIds: Set<string>;
  selectedStopOrder: number | null;
  onToggleItem: (itemId: string) => void;
  onNotFoundItem: (itemId: string) => void;
  onSelectStop: (order: number) => void;
}

// RN port of the web's Checklist.tsx (promotions omitted - not built on mobile yet).
export function Checklist({
  stopViews,
  checkedItemIds,
  notFoundItemIds,
  selectedStopOrder,
  onToggleItem,
  onNotFoundItem,
  onSelectStop,
}: ChecklistProps) {
  return (
    <View style={styles.list}>
      {stopViews.map(({ stop, items }) => {
        const allChecked = items.length > 0 && items.every((item) => checkedItemIds.has(item.id));
        const isSelected = selectedStopOrder === stop.order;

        return (
          <Pressable
            key={stop.nodeId}
            onPress={() => onSelectStop(stop.order)}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <View style={styles.header}>
              <View style={[styles.badge, allChecked && styles.badgeChecked]}>
                <Text style={styles.badgeText}>{stop.order}</Text>
              </View>
              <Text style={styles.stopLabel} numberOfLines={1}>
                {stop.label.replace(/\s*\n\s*/g, " ")}
              </Text>
              <Text style={styles.stopCount}>
                {items.filter((item) => checkedItemIds.has(item.id)).length}/{items.length}
              </Text>
            </View>
            <View style={styles.items}>
              {items.map((item) => (
                <ChecklistItem
                  key={item.id}
                  id={item.id}
                  displayName={item.displayName}
                  imageUrl={item.imageUrl}
                  checked={checkedItemIds.has(item.id)}
                  notFound={notFoundItemIds.has(item.id)}
                  onToggle={onToggleItem}
                  onNotFound={onNotFoundItem}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  card: {
    gap: 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardSelected: {
    borderColor: "#22d3ee",
    backgroundColor: COLORS.cyan50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cyan600,
  },
  badgeChecked: {
    backgroundColor: "#a3a3a3",
  },
  badgeText: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 12,
  },
  stopLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  stopCount: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.neutral500,
  },
  items: {
    paddingStart: 34,
  },
});
