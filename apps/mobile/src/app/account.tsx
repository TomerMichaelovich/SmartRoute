import { Link, Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { he } from "@smartroute/core/i18n/he";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";

export default function AccountScreen() {
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [pending, setPending] = useState(false);

  if (status === "guest") {
    return <Redirect href="/login" />;
  }
  if (status === "loading" || !user) {
    return <View style={styles.center} />;
  }

  async function handleLogout() {
    setPending(true);
    await logout();
    setPending(false);
    router.replace("/");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>{he.account.title}</Text>

        <Card style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{he.account.nameLabel}</Text>
            <Text style={styles.rowValue}>{user.displayName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{he.account.emailLabel}</Text>
            <Text style={[styles.rowValue, styles.ltr]}>{user.email}</Text>
          </View>
        </Card>

        <Link href="/household" asChild>
          <Button variant="secondary" fullWidth>
            {he.household.title}
          </Button>
        </Link>

        <Button variant="secondary" fullWidth onPress={handleLogout} disabled={pending}>
          {pending ? he.account.loggingOut : he.account.logout}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  card: {
    gap: 16,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.neutral500,
  },
  rowValue: {
    fontSize: 16,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  ltr: {
    writingDirection: "ltr",
    textAlign: "left",
  },
});
