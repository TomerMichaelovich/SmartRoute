import { Redirect, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListSharingPanel } from "@/components/ListSharingPanel";
import { COLORS } from "@/constants/colors";
import { useAuth } from "@/lib/auth-context";

/**
 * One list's sharing panel, opened from the home card's participants button
 * (the list screen shows the same panel inline).
 */
export default function ListSharingScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status } = useAuth();

  if (status === "guest") return <Redirect href="/login" />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <ListSharingPanel code={code} showIntro />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
});
