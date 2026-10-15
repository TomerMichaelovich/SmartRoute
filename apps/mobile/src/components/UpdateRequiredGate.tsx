import { useEffect, useState, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { checkRequiredUpdate, type RequiredUpdate } from "@/lib/version-check";

/**
 * Checks once per launch whether this app version is still supported. The
 * app renders normally while the check runs; only a confirmed too-old version
 * swaps in a blocking "please update" screen with a store link.
 */
export function UpdateRequiredGate({ children }: { children: ReactNode }) {
  const [requiredUpdate, setRequiredUpdate] = useState<RequiredUpdate | null>(null);

  useEffect(() => {
    void checkRequiredUpdate().then(setRequiredUpdate);
  }, []);

  if (!requiredUpdate) return children;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{he.appUpdate.title}</Text>
      <Text style={styles.body}>{he.appUpdate.body}</Text>
      <Button onPress={() => void Linking.openURL(requiredUpdate.updateUrl)} fullWidth>
        {he.appUpdate.button}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
    padding: 24,
    backgroundColor: COLORS.neutral50,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.neutral900,
    textAlign: "center",
  },
  body: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.neutral600,
    textAlign: "center",
  },
});
