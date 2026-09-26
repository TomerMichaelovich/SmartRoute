import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface MemberRowProps {
  member: HouseholdMemberView;
  isSelf: boolean;
  viewerIsOwner: boolean;
  onChanged: () => void;
}

// RN port of the web's MemberRow.tsx.
export function MemberRow({ member, isSelf, viewerIsOwner, onChanged }: MemberRowProps) {
  const canManage = viewerIsOwner && !isSelf;

  async function approve() {
    const res = await apiFetch("/api/household/members/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.userId }),
    });
    if (res.ok) onChanged();
  }

  function confirmRemove() {
    Alert.alert(he.household.members.removeConfirm, undefined, [
      { text: he.common.back, style: "cancel" },
      {
        text: he.household.members.remove,
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch("/api/household/members/remove", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: member.userId }),
          });
          if (res.ok) onChanged();
        },
      },
    ]);
  }

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name}>
          {member.displayName}
          {isSelf ? ` (${he.household.members.you})` : ""}
        </Text>
        <Text style={styles.meta}>
          {member.role === "owner" ? he.household.members.owner : member.email}
          {member.status === "pending" ? ` · ${he.household.members.pendingBadge}` : ""}
        </Text>
      </View>

      {canManage && (
        <View style={styles.actions}>
          {member.status === "pending" && (
            <Pressable onPress={approve}>
              <Text style={styles.approveText}>{he.household.members.approve}</Text>
            </Pressable>
          )}
          <Pressable onPress={confirmRemove}>
            <Text style={styles.removeText}>{he.household.members.remove}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.neutral100,
  },
  info: {
    gap: 2,
  },
  name: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.neutral900,
  },
  meta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  approveText: {
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.cyan700,
  },
  removeText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: "#dc2626",
  },
});
