import { Link } from "expo-router";
import { Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { HomeListWidget } from "@/components/HomeListWidget";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.hero}>
          <Image
            source={require("../../assets/images/navio-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={`${he.common.appName} – ${he.home.tagline}`}
          />
          <Text style={styles.subtitle}>{he.home.heroSubtitle}</Text>
        </View>

        <HomeListWidget />

        <Link href="/branches" asChild>
          <Button style={styles.startButton} fullWidth>
            {he.home.startShopping}
          </Button>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  // Mirrors the web home page's <main class="mx-auto flex w-full max-w-md flex-1
  // flex-col items-center justify-center gap-10 px-6 py-12 text-center">.
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  hero: {
    alignItems: "center",
    gap: 16,
  },
  logo: {
    width: 256,
    height: 256,
  },
  subtitle: {
    maxWidth: 320,
    textAlign: "center",
    color: COLORS.neutral600,
    fontFamily: FONTS.regular,
    fontSize: 16,
  },
  startButton: {
    maxWidth: 320,
  },
});
