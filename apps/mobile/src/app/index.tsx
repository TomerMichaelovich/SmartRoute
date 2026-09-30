import { Link } from "expo-router";
import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { HomeListWidget } from "@/components/HomeListWidget";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";

// navio-brand.png is 1071×585. Width and height are both set explicitly:
// with aspectRatio alone, Image fell back to the file's intrinsic size.
const LOGO_ASPECT = 1071 / 585;
const HEADER_LOGO_HEIGHT = 40;

export default function HomeScreen() {
  const { status, user } = useAuth();
  const loggedIn = status === "authenticated" && Boolean(user);
  // 75% of the screen width, capped so it stays modest on tablets.
  const logoWidth = Math.min(useWindowDimensions().width * 0.75, 320);
  const [guestHasList, setGuestHasList] = useState(false);

  if (loggedIn) {
    // App-style home: compact brand header, then the lists - whose card
    // carries the screen's single primary action.
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.appPage} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Image
              source={require("../../assets/images/navio-brand.png")}
              style={{ width: HEADER_LOGO_HEIGHT * LOGO_ASPECT, height: HEADER_LOGO_HEIGHT }}
              resizeMode="contain"
              accessibilityLabel={he.common.appName}
            />
            <Link href="/account" asChild>
              <Pressable style={styles.accountButton} accessibilityRole="button" accessibilityLabel={he.home.myAccount}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{user!.displayName.trim().charAt(0) || "?"}</Text>
                </View>
                <Text style={styles.accountButtonText}>{he.home.myAccount}</Text>
              </Pressable>
            </Link>
          </View>

          <Text style={styles.greeting}>{he.home.greeting(user!.displayName)}</Text>

          <HomeListWidget loggedIn />

          <Link href="/history" asChild>
            <Pressable style={styles.historyButton} accessibilityRole="button">
              <Text style={styles.historyIcon}>🧾</Text>
              <Text style={styles.historyText}>{he.history.title}</Text>
              {/* Bidi-mirrored in RTL, so this renders pointing left (forward). */}
              <Text style={styles.historyChevron}>›</Text>
            </Pressable>
          </Link>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Image
          source={require("../../assets/images/navio-brand.png")}
          style={{ width: logoWidth, height: logoWidth / LOGO_ASPECT }}
          resizeMode="contain"
          accessibilityLabel={`${he.common.appName} – ${he.home.tagline}`}
        />

        <HomeListWidget onHasListChange={setGuestHasList} />

        <View style={styles.actions}>
          {/* A guest who already has a list shops from its card; the only
              thing left to offer is an account, to keep more than one list. */}
          {guestHasList && <Text style={styles.guestHint}>{he.home.guestSaveHint}</Text>}
          <Link href="/register" asChild>
            <Button variant={guestHasList ? "secondary" : "primary"} fullWidth>
              {he.home.register}
            </Button>
          </Link>
          {guestHasList ? (
            <Link href="/login" asChild>
              <Text style={styles.guestLink}>{he.home.login}</Text>
            </Link>
          ) : (
            <>
              <Link href="/login" asChild>
                <Button variant="secondary" fullWidth>
                  {he.home.login}
                </Button>
              </Link>
              <Link href="/branches" asChild>
                <Text style={styles.guestLink}>{he.home.continueAsGuest}</Text>
              </Link>
            </>
          )}
        </View>
      </ScrollView>
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
  // flexGrow (not flex) so short content still centers, while content taller
  // than the screen scrolls instead of being clipped under the nav bar.
  page: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    gap: 40,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  // Top-aligned (unlike the guest landing), so the lists don't jump around
  // vertically as they load or grow.
  appPage: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    alignItems: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  topBar: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  accountButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    paddingVertical: 4,
    paddingStart: 4,
    paddingEnd: 12,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.cyan600,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.white,
  },
  accountButtonText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  greeting: {
    width: "100%",
    maxWidth: 360,
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  historyButton: {
    width: "100%",
    maxWidth: 360,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyIcon: {
    fontSize: 20,
  },
  historyText: {
    flex: 1,
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  historyChevron: {
    fontSize: 22,
    color: COLORS.neutral500,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    gap: 12,
  },
  guestHint: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
    textAlign: "center",
  },
  guestLink: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
    textDecorationLine: "underline",
  },
});
