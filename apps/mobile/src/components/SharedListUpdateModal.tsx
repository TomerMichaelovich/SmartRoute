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

interface SharedListUpdateModalProps {
  /** Who added the items (a name, or a generic "a participant"); null hides the dialog. */
  adderName: string | null;
  entries: SharedAdditionEntry[];
  busy: boolean;
  onChoose: (itemId: string, productId: string | null) => void;
  onConfirm: () => void;
  onLater: () => void;
}

/**
 * Mid-shop notice that another participant added items to the shared list. Each item is
 * matched to what this branch actually carries - an ambiguous one ("נס") offers the branch's
 * options to pick from - and confirming re-plans the route with them.
 */
export function SharedListUpdateModal({ adderName, entries, busy, onChoose, onConfirm, onLater }: SharedListUpdateModalProps) {
  const t = he.route.sharedUpdate;
  const anyChosen = entries.some((e) => e.chosenProductId !== null);
  return (
    <Modal visible={adderName !== null} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>🔔 {t.title}</Text>
          {adderName !== null && <Text style={styles.body}>{t.body(adderName, entries.length)}</Text>}

          <ScrollView style={styles.entries} contentContainerStyle={styles.entriesContent}>
            {entries.map((entry) => (
              <View key={entry.itemId} style={styles.entry}>
                <Text style={styles.entryName}>{entry.rawText}</Text>
                {entry.options.length === 0 ? (
                  <Text style={styles.notCarried}>{t.notCarried}</Text>
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
                            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{product.canonicalName}</Text>
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
          </ScrollView>

          <View style={styles.actions}>
            <Button onPress={anyChosen ? onConfirm : onLater} disabled={busy} fullWidth>
              {busy ? he.common.loading : anyChosen ? t.confirm : t.later}
            </Button>
            {anyChosen && (
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
  body: {
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral700,
  },
  entries: {
    flexGrow: 0,
  },
  entriesContent: {
    gap: 12,
  },
  entry: {
    gap: 6,
    borderRadius: 12,
    backgroundColor: COLORS.neutral50,
    padding: 12,
  },
  entryName: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  notCarried: {
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
