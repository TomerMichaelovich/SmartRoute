import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface GuestLimitsModalProps {
  visible: boolean;
  onRegister: () => void;
  onContinueAsGuest: () => void;
  onClose: () => void;
}

/**
 * Shown when "continue as guest" is tapped: what a guest gives up, numbered,
 * with signing up as the obvious next step and guest mode still one tap away.
 */
export function GuestLimitsModal({ visible, onRegister, onContinueAsGuest, onClose }: GuestLimitsModalProps) {
  const t = he.home.guestLimits;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.icon}>⚠️</Text>
            <Text style={styles.title}>{t.title}</Text>
          </View>

          <Text style={styles.intro}>{t.intro}</Text>
          <View style={styles.items}>
            {t.items.map((item, i) => (
              <View key={item} style={styles.item}>
                <View style={styles.number}>
                  <Text style={styles.numberText}>{i + 1}</Text>
                </View>
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>{t.footer}</Text>

          <View style={styles.actions}>
            <Button onPress={onRegister} fullWidth>
              {t.register}
            </Button>
            <Pressable onPress={onContinueAsGuest} hitSlop={8} accessibilityRole="button" style={styles.guestButton}>
              <Text style={styles.guestText}>{t.continueAnyway}</Text>
            </Pressable>
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
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    gap: 14,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    padding: 22,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    flex: 1,
    fontSize: 19,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  intro: {
    fontSize: 15,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  items: {
    gap: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  number: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  numberText: {
    fontSize: 13,
    fontFamily: FONTS.bold,
    color: "#b91c1c",
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  footer: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  actions: {
    gap: 10,
    alignItems: "center",
  },
  guestButton: {
    paddingVertical: 6,
  },
  guestText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textDecorationLine: "underline",
  },
});
