import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { HouseholdMemberView } from "@smartroute/core/domain/entities/household";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

const MAX_AVATARS = 3;
const AVATAR_SIZE = 28;
// Soft tints so stacked avatars stay distinguishable without shouting.
const AVATAR_TINTS = [
  { background: COLORS.cyan50, color: COLORS.cyan700 },
  { background: "#f0fdf4", color: "#15803d" },
  { background: "#fdf4ff", color: "#a21caf" },
  { background: "#fff7ed", color: "#c2410c" },
];

interface SharingData {
  role: "owner" | "member";
  members: HouseholdMemberView[];
}

function ChevronIcon() {
  // Points left: "forward" in an RTL layout.
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.neutral500} strokeWidth={2}>
      <Path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PlusIcon() {
  return (
    <Svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={COLORS.cyan700} strokeWidth={2.2}>
      <Path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The list screen's one-line summary of who shares the list: stacked initials,
 * a count and a pending-requests badge. Managing participants (invite, approve,
 * remove, leave) happens on the sharing screen this opens, so the list itself
 * keeps the screen.
 */
export function ListParticipantsBar({ code }: { code: string }) {
  const router = useRouter();
  const [data, setData] = useState<SharingData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      apiFetch(`/api/lists/${code}/sharing`)
        .then((res) => (res.ok ? res.json() : null))
        .then((json: SharingData | null) => {
          if (!cancelled && json) setData(json);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [code]),
  );

  const active = data?.members.filter((m) => m.status !== "pending") ?? [];
  const pendingCount = data?.role === "owner" ? data.members.length - active.length : 0;
  const isAlone = data !== null && active.length <= 1;

  return (
    <Pressable
      onPress={() => router.push(`/sharing/${code}`)}
      accessibilityRole="button"
      accessibilityLabel={he.myList.sharing.buttonLabel}
      style={({ pressed }) => [styles.bar, pressed && styles.barPressed]}
    >
      {isAlone ? (
        <View style={styles.inviteIcon}>
          <PlusIcon />
        </View>
      ) : (
        <View style={styles.avatars}>
          {active.slice(0, MAX_AVATARS).map((m, i) => {
            const tint = AVATAR_TINTS[i % AVATAR_TINTS.length];
            return (
              <View
                key={m.userId}
                style={[styles.avatar, { backgroundColor: tint.background, zIndex: MAX_AVATARS - i }, i > 0 && styles.avatarOverlap]}
              >
                <Text style={[styles.avatarText, { color: tint.color }]}>{m.displayName.trim().charAt(0)}</Text>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.label, isAlone && styles.labelInvite]} numberOfLines={1}>
        {data === null
          ? he.myList.sharing.buttonLabel
          : isAlone
            ? he.myList.sharing.inviteShort
            : he.myList.sharing.memberCount(active.length)}
      </Text>

      {pendingCount > 0 && (
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>{he.myList.sharing.pendingShort(pendingCount)}</Text>
        </View>
      )}

      <View style={styles.end}>
        {!isAlone && <Text style={styles.manage}>{he.myList.sharing.manage}</Text>}
        <ChevronIcon />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  barPressed: {
    backgroundColor: COLORS.neutral100,
  },
  avatars: {
    flexDirection: "row",
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlap: {
    marginStart: -8,
  },
  avatarText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
  },
  inviteIcon: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.cyan50,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.neutral900,
  },
  labelInvite: {
    color: COLORS.cyan700,
  },
  pendingBadge: {
    flexShrink: 1,
    borderRadius: 999,
    backgroundColor: "#fffbeb",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pendingText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: "#b45309",
  },
  end: {
    marginStart: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  manage: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
});
