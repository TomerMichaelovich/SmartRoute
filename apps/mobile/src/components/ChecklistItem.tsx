import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { resolveAssetUrl } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface ChecklistItemProps {
  id: string;
  displayName: string;
  imageUrl?: string;
  checked: boolean;
  notFound: boolean;
  onToggle: (id: string) => void;
  onNotFound: (id: string) => void;
}

// RN port of the web's ChecklistItem.tsx. No native <input type="checkbox"> on RN, so the
// checkbox is a small custom Pressable square instead.
export function ChecklistItem({ id, displayName, imageUrl, checked, notFound, onToggle, onNotFound }: ChecklistItemProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={() => onToggle(id)}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <View style={styles.checkboxDot} />}
        </View>
        {imageUrl && <Image source={{ uri: resolveAssetUrl(imageUrl) }} style={styles.image} />}
        <Text style={[styles.name, checked && styles.nameChecked]}>{displayName}</Text>
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
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.neutral100,
  },
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  nameChecked: {
    color: "#a3a3a3",
    textDecorationLine: "line-through",
  },
  notFoundButton: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
