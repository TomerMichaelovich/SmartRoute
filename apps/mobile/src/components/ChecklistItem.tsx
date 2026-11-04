import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { resolveAssetUrl } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface ChecklistItemProps {
  id: string;
  displayName: string;
  /** What the shopper chose for the line, shown small under it. */
  subtitle?: string | null;
  imageUrl?: string;
  checked: boolean;
  notFound: boolean;
  onToggle: (id: string) => void;
  onNotFound: (id: string) => void;
}

// RN port of the web's ChecklistItem.tsx. No native <input type="checkbox"> on RN, so the
// checkbox is a small custom Pressable square instead.
export function ChecklistItem({ id, displayName, subtitle, imageUrl, checked, notFound, onToggle, onNotFound }: ChecklistItemProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={() => onToggle(id)}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <View style={styles.checkboxDot} />}
        </View>
        {imageUrl && <Image source={{ uri: resolveAssetUrl(imageUrl) }} style={styles.image} />}
        <View style={styles.names}>
          <Text style={[styles.name, checked && styles.nameChecked]}>{displayName}</Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable onPress={() => onNotFound(id)} style={[styles.notFoundButton, notFound && styles.notFoundButtonActive]}>
        <Text style={[styles.notFoundText, notFound && styles.notFoundTextActive]}>
          {notFound ? he.route.notFoundMarked : he.route.notFoundButton}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  names: {
    flex: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.neutral300,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: COLORS.cyan600,
    borderColor: COLORS.cyan600,
  },
  checkboxDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: COLORS.white,
  },
  image: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  nameChecked: {
    color: "#a3a3a3",
    textDecorationLine: "line-through",
  },
  notFoundButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  notFoundButtonActive: {
    backgroundColor: "#fef3c7",
  },
  notFoundText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: "#a3a3a3",
  },
  notFoundTextActive: {
    color: "#92400e",
  },
});
