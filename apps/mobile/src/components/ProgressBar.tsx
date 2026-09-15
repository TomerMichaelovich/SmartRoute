import { StyleSheet, View } from "react-native";
import { COLORS } from "@/constants/colors";

// RN port of the web's ProgressBar.tsx.
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    width: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.neutral200,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: COLORS.cyan500,
  },
});
