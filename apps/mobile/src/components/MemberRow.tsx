import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface MemberRowProps {
  /** Share code of the list this participant belongs to. */
  listCode: string;
  member: HouseholdMemberView;
  isSelf: boolean;
  viewerIsOwner: boolean;
  onChanged: () => void;
}

// One participant of a shared list, with approve/remove for the list's owner.
export function MemberRow({ listCode, member, isSelf, viewerIsOwner, onChanged }: MemberRowProps) {
  const canManage = viewerIsOwner && !isSelf && member.role !== "owner";

  async function approve() {
    const res = await apiFetch(`/api/lists/${listCode}/members/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: member.userId }),
    });
    if (res.ok) onChanged();
  }

  function confirmRemove() {
    Alert.alert(he.myList.sharing.removeConfirm, undefined, [
      { text: he.myList.manage.cancel, style: "cancel" },
      {
        text: he.myList.sharing.remove,
        style: "destructive",
        onPress: async () => {
          const res = await apiFetch(`/api/lists/${listCode}/members/remove`, {
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
          {isSelf ? ` (${he.myList.sharing.you})` : ""}
        </Text>
        <Text style={styles.meta}>
          {member.role === "owner" ? he.myList.sharing.owner : member.email}
          {member.status === "pending" ? ` · ${he.myList.sharing.pendingBadge}` : ""}
        </Text>
      </View>

      {canManage && (
        <View style={styles.actions}>
          {member.status === "pending" && (
            <Pressable onPress={approve} hitSlop={8}>
              <Text style={styles.approveText}>{he.myList.sharing.approve}</Text>
            </Pressable>
          )}
          <Pressable onPress={confirmRemove} hitSlop={8}>
            <Text style={styles.removeText}>
              {member.status === "pending" ? he.myList.sharing.decline : he.myList.sharing.remove}
            </Text>
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
    flexShrink: 1,
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
