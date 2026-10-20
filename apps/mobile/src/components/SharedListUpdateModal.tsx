import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { Product } from "@smartroute/core/domain/entities/product";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export interface SharedAdditionEntry {
  itemId: string;
  rawText: string;
  /** What this branch carries that the item could mean, best first. */
  options: Product[];
  /** Picked product, or null = don't buy it here. */
  chosenProductId: string | null;
}

export interface SharedRemovalEntry {
  itemId: string;
  name: string;
  /** Already ticked off - it may be in the cart and need putting back. */
  collected: boolean;
}

interface SharedListUpdateModalProps {
  visible: boolean;
  /** Who added / removed the items (a name, or a generic "a participant"). */
  adderName: string;
  removerName: string;
  additions: SharedAdditionEntry[];
  removals: SharedRemovalEntry[];
  busy: boolean;
  onChoose: (itemId: string, productId: string | null) => void;
  onConfirm: () => void;
  onLater: () => void;
}

/**
 * Mid-shop notice that another participant changed the shared list. Added items are matched
 * to what this branch actually carries - an ambiguous one ("נס") offers the branch's options
 * to pick from - removed ones are listed, and confirming re-plans the route accordingly.
 */
export function SharedListUpdateModal({
  visible,
  adderName,
  removerName,
  additions,
  removals,
  busy,
  onChoose,
  onConfirm,
  onLater,
}: SharedListUpdateModalProps) {
  const t = he.route.sharedUpdate;
  const changesRoute = removals.length > 0 || additions.some((e) => e.chosenProductId !== null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>🔔 {t.title}</Text>

          <ScrollView style={styles.sections} contentContainerStyle={styles.sectionsContent}>
            {additions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.body}>{t.body(adderName, additions.length)}</Text>
                {additions.map((entry) => (
                  <View key={entry.itemId} style={styles.entry}>
                    <Text style={styles.entryName}>{entry.rawText}</Text>
                    {entry.options.length === 0 ? (
                      <Text style={styles.warning}>{t.notCarried}</Text>
                    ) : (
                      <>
                        {entry.options.length > 1 && <Text style={styles.hint}>{t.chooseHint}</Text>}
                        <View style={styles.chips}>
                          {entry.options.map((product) => {
                            const selected = entry.chosenProductId === product.id;
                            return (
                              <Pressable
                                key={product.id}
                                onPress={() => onChoose(entry.itemId, product.id)}
                                style={[styles.chip, selected && styles.chipSelected]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                              >
                                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                  {product.canonicalName}
                                </Text>
                              </Pressable>
                            );
                          })}
                          <Pressable
                            onPress={() => onChoose(entry.itemId, null)}
                            style={[styles.chip, entry.chosenProductId === null && styles.chipSkipSelected]}
                            accessibilityRole="button"
                          >
                            <Text style={styles.chipSkipText}>{t.skip}</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </View>
            )}

            {removals.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.body}>{t.removedBody(removerName, removals.length)}</Text>
                {removals.map((entry) => (
                  <View key={entry.itemId} style={[styles.entry, styles.removedEntry]}>
                    <Text style={[styles.entryName, styles.removedName]}>{entry.name}</Text>
                    {entry.collected && <Text style={styles.warning}>{t.alreadyCollected}</Text>}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Button onPress={changesRoute ? onConfirm : onLater} disabled={busy} fullWidth>
              {busy ? he.common.loading : changesRoute ? t.confirm : t.later}
            </Button>
            {changesRoute && (
              <Pressable onPress={onLater} disabled={busy} hitSlop={8} accessibilityRole="button">
                <Text style={styles.later}>{t.later}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "85%",
    gap: 12,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  sections: {
    flexGrow: 0,
  },
  sectionsContent: {
    gap: 16,
  },
  section: {
    gap: 8,
  },
  body: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral700,
  },
  entry: {
    gap: 6,
    borderRadius: 12,
    backgroundColor: COLORS.neutral50,
    padding: 12,
  },
  removedEntry: {
    backgroundColor: "#fef2f2",
  },
  entryName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  removedName: {
    color: "#991b1b",
    textDecorationLine: "line-through",
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  warning: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: "#b45309",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: COLORS.cyan500,
    backgroundColor: COLORS.cyan50,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  chipTextSelected: {
    color: COLORS.cyan700,
  },
  chipSkipSelected: {
    borderColor: COLORS.neutral300,
    backgroundColor: COLORS.neutral100,
  },
  chipSkipText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  actions: {
    gap: 10,
    alignItems: "center",
  },
  later: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
