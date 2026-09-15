import { StyleSheet, View, type ViewProps } from "react-native";
import { COLORS } from "@/constants/colors";

// RN analog of the web's Card.tsx (rounded-2xl bg-white p-4 shadow-sm).
export function Card({ style, ...rest }: ViewProps) {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
});
