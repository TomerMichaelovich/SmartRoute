import { Link, Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type {
  Household,
  HouseholdInvite,
  HouseholdMemberView,
  HouseholdMembership,
} from "@smartroute/core/domain/entities/household";
import type { ShoppingList } from "@smartroute/core/domain/entities/shopping-list";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { AuthField } from "@/components/AuthField";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";
import { useAuth } from "@/lib/auth-context";
import { MemberRow } from "@/components/MemberRow";
import { InviteCard } from "@/components/InviteCard";

interface HouseholdContext {
  household: Household | null;
  membership?: HouseholdMembership;
  members?: HouseholdMemberView[];
  invites?: HouseholdInvite[];
  sharedList?: ShoppingList | null;
}

export default function HouseholdScreen() {
  const { status, user } = useAuth();
  const [ctx, setCtx] = useState<HouseholdContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/household");
    if (res.ok) setCtx(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load();
  }, [status, load]);

  if (status === "guest") return <Redirect href="/login" />;
  if (status === "loading" || loading || !ctx) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await apiFetch("/api/household", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setBusy(false);
    if (res.ok) {
      setName("");
      void load();
    } else {
      Alert.alert(he.common.error);
    }
  }

  // --- No household ---
  if (!ctx.household) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{he.household.title}</Text>
          <Text style={styles.subtitle}>{he.household.subtitle}</Text>
        </View>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>{he.household.none.title}</Text>
          <Text style={styles.cardBody}>{he.household.none.body}</Text>
          <AuthField label={he.household.none.createLabel} placeholder={he.household.none.createPlaceholder} value={name} onChangeText={setName} />
          <Button onPress={handleCreate} disabled={busy} fullWidth>
            {he.household.none.createButton}
          </Button>
        </Card>
        <Link href="/household/join" asChild>
          <Button variant="secondary" fullWidth>
            {he.myList.haveCode}
          </Button>
        </Link>
      </ScrollView>
    );
  }

  const { household, membership, members = [], invites = [], sharedList } = ctx;

  // --- Pending approval ---
  if (membership?.status === "pending") {
    async function handleCancel() {
      setBusy(true);
      await apiFetch("/api/household/join/cancel", { method: "POST" });
      setBusy(false);
      void load();
    }
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.title}>{he.household.title}</Text>
        <Card style={[styles.card, styles.pendingCard]}>
          <Text style={styles.pendingTitle}>{he.household.pending.title}</Text>
          <Text style={styles.pendingBody}>{he.household.pending.body(household.name)}</Text>
          <Button variant="secondary" onPress={handleCancel} disabled={busy}>
            {he.household.pending.cancel}
          </Button>
        </Card>
      </ScrollView>
    );
  }

  const isOwner = membership?.role === "owner";

  async function handleGenerateInvite() {
    setBusy(true);
    const res = await apiFetch("/api/household/invites", { method: "POST" });
    setBusy(false);
    if (res.ok) void load();
    else Alert.alert(he.common.error);
  }

  async function handleLeave() {
    setBusy(true);
    const res = await apiFetch("/api/household/leave", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      void load();
    } else {
      const data = await res.json().catch(() => null);
      if (data?.error === "owner_leave") Alert.alert(he.household.ownerCantLeave);
      else Alert.alert(he.common.error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>{household.name}</Text>
        <Text style={styles.subtitle}>{he.household.subtitle}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{he.household.sharedList.badge}</Text>
        {sharedList ? (
          <Link href="/household/list" asChild>
            <Button fullWidth>{he.household.sharedList.openButton}</Button>
          </Link>
        ) : (
          <Link href="/household/new-list" asChild>
            <Button variant="secondary" fullWidth>
              {he.household.sharedList.createButton}
            </Button>
          </Link>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{he.household.members.heading}</Text>
        <Card style={styles.membersCard}>
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isSelf={m.userId === user?.id}
              viewerIsOwner={Boolean(isOwner)}
              onChanged={load}
            />
          ))}
        </Card>
      </View>

      {isOwner && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{he.household.invite.heading}</Text>
          <Text style={styles.expiresNote}>{he.household.invite.expiresNote}</Text>
          {invites.map((inv) => (
            <InviteCard key={inv.id} inviteId={inv.id} code={inv.code} onRevoked={load} />
          ))}
          <Button variant="secondary" onPress={handleGenerateInvite} disabled={busy}>
            {he.household.invite.generate}
          </Button>
        </View>
      )}

      <Button variant="secondary" onPress={handleLeave} disabled={busy}>
        {he.household.leave}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.neutral50,
  },
  page: {
    width: "100%",
    maxWidth: 448,
    alignSelf: "center",
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    gap: 4,
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
  card: {
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral900,
  },
  cardBody: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral600,
  },
  pendingCard: {
    backgroundColor: "#fffbeb",
  },
  pendingTitle: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: "#92400e",
  },
  pendingBody: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#92400e",
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.neutral700,
  },
  membersCard: {
    padding: 0,
  },
  expiresNote: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
