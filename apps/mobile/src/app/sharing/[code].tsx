import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { HouseholdInvite, HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { MemberRow } from "@/components/MemberRow";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { shareInvite } from "@/lib/list-invite";
import { clearMyListCode, getMyListCode } from "@/lib/my-list-storage";
import { refreshMyListWidget } from "@/widgets/refresh-my-list-widget";

interface SharingData {
  role: "owner" | "member";
  listName: string | null;
  members: HouseholdMemberView[];
}

/**
 * One list's sharing panel, opened from the home card's participants button:
 * who takes part, and - for the list's owner - inviting people (the list's
 * one invite link, joining waits for approval) and approving/removing them.
 * A participant can leave the list from here.
 */
export default function ListSharingScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const { status, user } = useAuth();
  const [data, setData] = useState<SharingData | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/lists/${code}/sharing`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [code]);

  useFocusEffect(
    useCallback(() => {
      if (status === "authenticated") void load();
    }, [status, load]),
  );

  if (status === "guest") return <Redirect href="/login" />;

  if (!data) {
    return (
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.subtitle}>{he.common.error}</Text>
            <Button variant="secondary" onPress={load}>
              {he.history.retry}
            </Button>
          </>
        ) : (
          <ActivityIndicator />
        )}
      </View>
    );
  }

  const listName = data.listName ?? he.myList.defaultName();
  const isOwner = data.role === "owner";

  async function handleInvite() {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/lists/${code}/invites`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { invite }: { invite: HouseholdInvite } = await res.json();
      await shareInvite(listName, invite.code);
    } catch {
      Alert.alert(he.common.error);
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    Alert.alert(he.myList.sharing.leave, he.myList.sharing.leaveConfirm, [
      { text: he.myList.manage.cancel, style: "cancel" },
      {
        text: he.myList.sharing.leave,
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(`/api/lists/${code}/leave`, { method: "POST" }).catch(() => null);
          if (!res?.ok) {
            Alert.alert(he.common.error);
            return;
          }
          if ((await getMyListCode()) === code) await clearMyListCode();
          refreshMyListWidget();
          router.dismissTo("/");
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{he.myList.sharing.title}</Text>
          <Text style={styles.subtitle}>{he.myList.sharing.subtitle(listName)}</Text>
        </View>

        {isOwner && (
          <View style={styles.section}>
            <Button onPress={handleInvite} disabled={busy} fullWidth>
              {busy ? he.common.loading : he.myList.sharing.invite}
            </Button>
            <Text style={styles.hint}>{he.myList.sharing.inviteHint}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{he.myList.sharing.membersHeading}</Text>
          <Card style={styles.membersCard}>
            {data.members.map((m) => (
              <MemberRow
                key={m.userId}
                listCode={code}
                member={m}
                isSelf={m.userId === user?.id}
                viewerIsOwner={isOwner}
                onChanged={load}
              />
            ))}
          </Card>
        </View>

        {!isOwner && (
          <Button variant="secondary" onPress={confirmLeave} fullWidth>
            {he.myList.sharing.leave}
          </Button>
        )}
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
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 24,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 24,
    fontFamily: FONTS.bold,
    color: COLORS.neutral900,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  hint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  membersCard: {
    padding: 0,
  },
});
