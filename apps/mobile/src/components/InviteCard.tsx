import { useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { he } from "@smartroute/core/i18n/he";
import { apiFetch } from "@/lib/api";
import { siteUrl } from "@/lib/app-links";
import { Button } from "@/components/Button";
import { COLORS } from "@/constants/colors";
import { FONTS } from "@/constants/fonts";

interface InviteCardProps {
  inviteId: string;
  code: string;
  onRevoked: () => void;
}

// RN port of the web's InviteLink.tsx - shares via the native Share sheet
// instead of clipboard-copy, since that's the natural mobile equivalent.
export function InviteCard({ inviteId, code, onRevoked }: InviteCardProps) {
  const [busy, setBusy] = useState(false);
  const url = siteUrl(`/household/join/${code}`);

  async function handleShare() {
    try {
      await Share.share({ message: url });
    } catch {
      // User dismissed the share sheet.
    }
  }

  async function handleRevoke() {
    setBusy(true);
    const res = await apiFetch(`/api/household/invites/${inviteId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) onRevoked();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{he.household.invite.linkLabel}</Text>
      <Text style={styles.url}>{url}</Text>
      <View style={styles.actions}>
        <Button variant="secondary" onPress={handleShare}>
          {he.household.invite.copy}
        </Button>
        <Button variant="secondary" onPress={handleRevoke} disabled={busy}>
          {he.household.invite.revoke}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.neutral200,
    backgroundColor: COLORS.white,
    padding: 12,
  },
  label: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral500,
  },
  url: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.neutral700,
    backgroundColor: COLORS.neutral50,
    borderRadius: 8,
    padding: 8,
    writingDirection: "ltr",
    textAlign: "left",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
});
