import { Heebo_400Regular, Heebo_500Medium, Heebo_600SemiBold, Heebo_700Bold, useFonts } from "@expo-google-fonts/heebo";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { I18nManager, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { PendingInviteResume } from "@/components/PendingInviteResume";
import { UpdateRequiredGate } from "@/components/UpdateRequiredGate";
import { COLORS } from "@/constants/colors";
import { AuthProvider } from "@/lib/auth-context";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
  });

  useEffect(() => {
    // Takes effect after a reload - first launch renders LTR, then one manual
    // reload flips it. Expected, not a bug.
    if (!I18nManager.isRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(true);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <AuthProvider>
        {/* Android draws the app edge-to-edge and the system bars are transparent
            (see expo-navigation-bar in app.json), so keep every screen clear of
            them here and let the app background show through behind the bars. */}
        <SafeAreaView style={styles.root}>
          <UpdateRequiredGate>
            <Stack screenOptions={{ headerShown: false }} />
            {/* Inside the gate: a blocked old version has no navigator to open links into. */}
            <PendingInviteResume />
          </UpdateRequiredGate>
        </SafeAreaView>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
});
